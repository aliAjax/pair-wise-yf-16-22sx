// 滑雪板调校维护系统 —— 状态管理
// 职责：
//  1. 雪板档案 / 调校工单 / 底板损伤记录 按编号三方合并
//  2. 刃角、修补位置冲突两版都留，选定后才能完工
//  3. 两名技师同时提交同一块雪板，先到的生效（乐观并发）
//  4. 刃角基线改动：未完工方案立即失效重算，已完工冻结
//  5. 工位容量满后新任务排队
//  6. 合并失败后只重试没并进去的部分

import { useMemo, useReducer } from "react";
import {
  chooseConflict,
  mergeDraft,
  mergeRecord,
  type CurrentState,
} from "./merge";
import {
  initialBoards,
  initialDamages,
  initialWorkOrders,
  INITIAL_BASELINE,
  stations,
  technicians,
} from "./seed";
import type {
  BaseDamageRecord,
  MergeBatch,
  OfflineDraft,
  SnowboardProfile,
  TuningWorkOrder,
} from "./types";
import { STATION_CAPACITY } from "./types";

interface ShopState {
  boards: SnowboardProfile[];
  workOrders: TuningWorkOrder[];
  damages: BaseDamageRecord[];
  baselineEdgeAngle: number;
  boardVersions: Record<string, number>; // 每块雪板的版本号（先到生效）
  queue: string[];                        // 排队中的工单号
  drafts: OfflineDraft[];                 // 未完全合并的离线草稿
  batches: MergeBatch[];                  // 合并批次历史
  techs: typeof technicians;
  selectedTechId: string;
}

const initialState: ShopState = {
  boards: initialBoards,
  workOrders: initialWorkOrders,
  damages: initialDamages,
  baselineEdgeAngle: INITIAL_BASELINE,
  boardVersions: Object.fromEntries(initialBoards.map((b) => [b.id, 0])),
  queue: [],
  drafts: [],
  batches: [],
  techs: technicians,
  selectedTechId: technicians[0].id,
};

let draftSeq = 0;
let batchSeq = 0;

function now() {
  return Date.now();
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

// 取一块雪板的当前官方聚合
function currentOf(state: ShopState, boardId: string): CurrentState {
  const profile = state.boards.find((b) => b.id === boardId)!;
  const workOrder = state.workOrders.find((w) => w.boardId === boardId)!;
  const damage = state.damages.find((d) => d.boardId === boardId)!;
  return {
    profile,
    workOrder,
    damage,
    version: state.boardVersions[boardId] ?? 0,
  };
}

// 把合并后的值写回官方记录
function applyMerged(
  state: ShopState,
  boardId: string,
  recordType: "profile" | "workOrder" | "damage",
  merged: Record<string, unknown>
) {
  if (recordType === "profile") {
    state.boards = state.boards.map((b) =>
      b.id === boardId ? ({ ...b, ...merged } as SnowboardProfile) : b
    );
  } else if (recordType === "workOrder") {
    state.workOrders = state.workOrders.map((w) =>
      w.boardId === boardId ? ({ ...w, ...merged } as TuningWorkOrder) : w
    );
  } else {
    state.damages = state.damages.map((d) =>
      d.boardId === boardId ? ({ ...d, ...merged } as BaseDamageRecord) : d
    );
  }
}

// 重算某块雪板工单的冲突待定标记
function recomputeConflictPending(state: ShopState, boardId: string) {
  const wo = state.workOrders.find((w) => w.boardId === boardId);
  if (!wo) return;
  const pending = state.batches.some(
    (b) =>
      b.boardId === boardId &&
      b.results.some(
        (r) => r.status === "conflict" && r.conflicts?.some((c) => c.choice === null)
      )
  );
  state.workOrders = state.workOrders.map((w) =>
    w.boardId === boardId ? { ...w, conflictPending: pending } : w
  );
}

// 工位排队：把排队中的工单按顺序补到工位上
function processQueue(state: ShopState) {
  const activeCount = state.workOrders.filter((w) => w.status === "active").length;
  let free = STATION_CAPACITY - activeCount;
  if (free <= 0) return;
  const queued = state.queue
    .map((id) => state.workOrders.find((w) => w.id === id))
    .filter((w): w is TuningWorkOrder => !!w && w.status === "queued")
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const w of queued) {
    if (free <= 0) break;
    state.workOrders = state.workOrders.map((x) =>
      x.id === w.id ? { ...x, status: "active" } : x
    );
    state.queue = state.queue.filter((id) => id !== w.id);
    free--;
  }
}

type Action =
  | { type: "SELECT_TECH"; techId: string }
  | { type: "TAKE_OFFLINE"; boardId: string }
  | { type: "EDIT_DRAFT"; draftId: string; section: "profile" | "workOrder" | "damage"; field: string; value: unknown }
  | { type: "SUBMIT_DRAFT"; draftId: string }
  | { type: "MERGE_DRAFT"; draftId: string }
  | { type: "RESOLVE_CONFLICT"; batchId: string; recordType: "profile" | "workOrder" | "damage"; field: "edgeAngle" | "repairPosition"; choice: "official" | "offline" }
  | { type: "COMPLETE_WORKORDER"; workOrderId: string }
  | { type: "RECALC_WORKORDER"; workOrderId: string }
  | { type: "CHANGE_BASELINE"; newBaseline: number }
  | { type: "RETRY_BATCH"; batchId: string }
  | { type: "CREATE_WORKORDER"; boardId: string }
  | { type: "SIMULTANEOUS_SUBMIT"; boardId: string };

function reducer(state: ShopState, action: Action): ShopState {
  switch (action.type) {
    case "SELECT_TECH":
      return { ...state, selectedTechId: action.techId };

    case "TAKE_OFFLINE": {
      const cur = currentOf(state, action.boardId);
      const draft: OfflineDraft = {
        id: `DRAFT-${++draftSeq}`,
        technicianId: state.selectedTechId,
        boardId: action.boardId,
        createdAt: now(),
        submittedAt: 0,
        baseVersion: cur.version,
        base: {
          profile: clone(cur.profile),
          workOrder: clone(cur.workOrder),
          damage: clone(cur.damage),
        },
        profile: clone(cur.profile),
        workOrder: clone(cur.workOrder),
        damage: clone(cur.damage),
      };
      return { ...state, drafts: [...state.drafts, draft] };
    }

    case "EDIT_DRAFT": {
      return {
        ...state,
        drafts: state.drafts.map((d) => {
          if (d.id !== action.draftId) return d;
          const section = d[action.section] as unknown as Record<string, unknown>;
          return {
            ...d,
            [action.section]: { ...section, [action.field]: action.value },
          };
        }),
      };
    }

    case "SUBMIT_DRAFT": {
      return {
        ...state,
        drafts: state.drafts.map((d) =>
          d.id === action.draftId ? { ...d, submittedAt: now() } : d
        ),
      };
    }

    case "MERGE_DRAFT": {
      const draft = state.drafts.find((d) => d.id === action.draftId);
      if (!draft) return state;
      const cur = currentOf(state, draft.boardId);
      const { results, status } = mergeDraft(draft, cur);
      const batch: MergeBatch = {
        id: `BATCH-${++batchSeq}`,
        draftId: draft.id,
        boardId: draft.boardId,
        technicianId: draft.technicianId,
        submittedAt: draft.submittedAt || now(),
        status,
        results,
        draft: clone(draft),
      };

      const next: ShopState = {
        ...state,
        boards: [...state.boards],
        workOrders: [...state.workOrders],
        damages: [...state.damages],
        boardVersions: { ...state.boardVersions },
        queue: [...state.queue],
        batches: [batch, ...state.batches],
      };

      if (status === "rejected") {
        // 先到生效：整批拒绝，草稿快照留在批次中以便重试（重新拉取后再并）
        next.drafts = state.drafts.filter((d) => d.id !== draft.id);
        return next;
      }

      // 应用已合并的记录；冲突的记录暂不写回，两版都留
      let anyApplied = false;
      for (const r of results) {
        if (r.status === "merged" && r.merged) {
          applyMerged(next, draft.boardId, r.recordType, r.merged);
          anyApplied = true;
        }
      }
      if (anyApplied) {
        next.boardVersions[draft.boardId] = cur.version + 1;
      }
      // 草稿一次性：合并后移除，未并入部分通过批次“重试未并入部分”
      next.drafts = state.drafts.filter((d) => d.id !== draft.id);
      recomputeConflictPending(next, draft.boardId);
      processQueue(next);
      return next;
    }

    case "RESOLVE_CONFLICT": {
      const next: ShopState = {
        ...state,
        boards: [...state.boards],
        workOrders: [...state.workOrders],
        damages: [...state.damages],
        boardVersions: { ...state.boardVersions },
        queue: [...state.queue],
        batches: state.batches.map((b) => {
          if (b.id !== action.batchId) return b;
          const results = chooseConflict(
            b.results,
            action.recordType,
            action.field,
            action.choice
          );
          const allChosen = results.every((r) => r.status === "merged");
          return { ...b, results, status: allChosen ? "done" : "partial" };
        }),
      };
      // 应用已选定的记录
      const batch = next.batches.find((b) => b.id === action.batchId);
      if (batch) {
        for (const r of batch.results) {
          if (r.status === "merged" && r.merged) {
            applyMerged(next, batch.boardId, r.recordType, r.merged);
          }
        }
        next.boardVersions[batch.boardId] =
          (next.boardVersions[batch.boardId] ?? 0) + 1;
        recomputeConflictPending(next, batch.boardId);
      }
      processQueue(next);
      return next;
    }

    case "COMPLETE_WORKORDER": {
      const wo = state.workOrders.find((w) => w.id === action.workOrderId);
      if (!wo) return state;
      // 完工前置：未失效、无未解决冲突、在工位上
      if (wo.stale || wo.conflictPending || wo.status !== "active") return state;
      const next: ShopState = {
        ...state,
        workOrders: state.workOrders.map((w) =>
          w.id === action.workOrderId
            ? { ...w, status: "completed", frozen: true }
            : w
        ),
        queue: state.queue.filter((id) => id !== action.workOrderId),
      };
      processQueue(next);
      return next;
    }

    case "RECALC_WORKORDER": {
      const wo = state.workOrders.find((w) => w.id === action.workOrderId);
      if (!wo || !wo.stale) return state;
      const next: ShopState = {
        ...state,
        workOrders: state.workOrders.map((w) =>
          w.id === action.workOrderId
            ? {
                ...w,
                edgeAngle: state.baselineEdgeAngle + w.edgeAngleOffset,
                baselineAtCreation: state.baselineEdgeAngle,
                stale: false,
              }
            : w
        ),
      };
      return next;
    }

    case "CHANGE_BASELINE": {
      const newBaseline = action.newBaseline;
      const next: ShopState = {
        ...state,
        baselineEdgeAngle: newBaseline,
        workOrders: state.workOrders.map((w) => {
          if (w.status === "completed" || w.frozen) {
            // 已完工：冻结，不随基线变动
            return { ...w, frozen: true };
          }
          // 未完工：立即失效，等待重算
          return { ...w, stale: true };
        }),
      };
      return next;
    }

    case "RETRY_BATCH": {
      const batch = state.batches.find((b) => b.id === action.batchId);
      if (!batch) return state;
      const draft = batch.draft;
      const cur = currentOf(state, batch.boardId);
      const next: ShopState = {
        ...state,
        boards: [...state.boards],
        workOrders: [...state.workOrders],
        damages: [...state.damages],
        boardVersions: { ...state.boardVersions },
        queue: [...state.queue],
        batches: [...state.batches],
      };

      // 只重试没并进去的部分：对未合并的记录重新三方合并（重新拉取后再并）
      const retryResults = batch.results.map((r) => {
        if (r.status === "merged") return r;
        if (!draft) return r;
        const baseRecord =
          r.recordType === "profile"
            ? draft.base.profile
            : r.recordType === "workOrder"
              ? draft.base.workOrder
              : draft.base.damage;
        const officialRecord =
          r.recordType === "profile"
            ? cur.profile
            : r.recordType === "workOrder"
              ? cur.workOrder
              : cur.damage;
        const offlineRecord =
          r.recordType === "profile"
            ? draft.profile
            : r.recordType === "workOrder"
              ? draft.workOrder
              : draft.damage;
        // 重新三方合并（跳过版本判定，相当于重新拉取后再改再提）
        const out = mergeRecord(
          baseRecord as unknown as Record<string, unknown>,
          officialRecord as unknown as Record<string, unknown>,
          offlineRecord as unknown as Record<string, unknown>
        );
        return {
          ...r,
          status: out.conflicts.length > 0 ? ("conflict" as const) : ("merged" as const),
          conflicts: out.conflicts,
          merged: out.merged,
          reason: undefined,
        };
      });

      // 应用重试后合并的记录
      let anyApplied = false;
      for (const r of retryResults) {
        if (r.status === "merged" && r.merged) {
          applyMerged(next, batch.boardId, r.recordType, r.merged);
          anyApplied = true;
        }
      }
      if (anyApplied) {
        next.boardVersions[batch.boardId] = cur.version + 1;
      }
      const allMerged = retryResults.every((r) => r.status === "merged");
      next.batches = next.batches.map((b) =>
        b.id === batch.id
          ? {
              ...b,
              results: retryResults,
              status: allMerged ? "done" : "partial",
            }
          : b
      );
      recomputeConflictPending(next, batch.boardId);
      processQueue(next);
      return next;
    }

    case "CREATE_WORKORDER": {
      const board = state.boards.find((b) => b.id === action.boardId);
      if (!board) return state;
      const nums = state.workOrders
        .map((w) => parseInt(w.id.replace("ORD-", ""), 10))
        .filter((n) => !Number.isNaN(n));
      const nextNum = (nums.length ? Math.max(...nums) : 118) + 1;
      const newWO: TuningWorkOrder = {
        id: `ORD-${nextNum}`,
        boardId: board.id,
        edgeAngle: state.baselineEdgeAngle,
        edgeAngleOffset: 0,
        repairPosition: "待定",
        waxType: "低温蜡",
        status: "queued",
        baselineAtCreation: state.baselineEdgeAngle,
        stale: false,
        frozen: false,
        edgeAngleChoice: null,
        repairPositionChoice: null,
        conflictPending: false,
      };
      const next: ShopState = {
        ...state,
        workOrders: [...state.workOrders, newWO],
        queue: [...state.queue, newWO.id],
      };
      processQueue(next);
      return next;
    }

    case "SIMULTANEOUS_SUBMIT": {
      // 演示：两名技师同时提交同一块雪板，先到的生效
      const cur = currentOf(state, action.boardId);
      const techA = state.techs[0];
      const techB = state.techs[1];
      const baseTime = now();

      const makeDraft = (
        tech: typeof technicians[number],
        edit: (d: OfflineDraft) => void,
        submittedAt: number
      ): OfflineDraft => {
        const d: OfflineDraft = {
          id: `DRAFT-${++draftSeq}`,
          technicianId: tech.id,
          boardId: action.boardId,
          createdAt: baseTime - 60000,
          submittedAt,
          baseVersion: cur.version,
          base: {
            profile: clone(cur.profile),
            workOrder: clone(cur.workOrder),
            damage: clone(cur.damage),
          },
          profile: clone(cur.profile),
          workOrder: clone(cur.workOrder),
          damage: clone(cur.damage),
        };
        edit(d);
        return d;
      };

      // 技师 A 改刃角，技师 B 改修补位置；同一时间提交
      const draftA = makeDraft(
        techA,
        (d) => {
          d.workOrder.edgeAngle = cur.workOrder.edgeAngle + 1;
          d.profile.edgeAngle = cur.profile.edgeAngle + 1;
        },
        baseTime
      );
      const draftB = makeDraft(
        techB,
        (d) => {
          d.workOrder.repairPosition = "重新修补位置X";
          d.damage.repairPosition = "重新修补位置X";
        },
        baseTime // 同时提交
      );

      // 按提交顺序合并：A 先到先生效，B 后到被拒
      const next: ShopState = {
        ...state,
        boards: [...state.boards],
        workOrders: [...state.workOrders],
        damages: [...state.damages],
        boardVersions: { ...state.boardVersions },
        queue: [...state.queue],
        drafts: [...state.drafts],
        batches: [...state.batches],
      };

      const order = [draftA, draftB];
      for (const draft of order) {
        const c = currentOf(next, draft.boardId);
        const { results, status } = mergeDraft(draft, c);
        const batch: MergeBatch = {
          id: `BATCH-${++batchSeq}`,
          draftId: draft.id,
          boardId: draft.boardId,
          technicianId: draft.technicianId,
          submittedAt: draft.submittedAt,
          status,
          results,
          draft: clone(draft),
        };
        next.batches = [batch, ...next.batches];
        if (status !== "rejected") {
          let anyApplied = false;
          for (const r of results) {
            if (r.status === "merged" && r.merged) {
              applyMerged(next, draft.boardId, r.recordType, r.merged);
              anyApplied = true;
            }
          }
          if (anyApplied) next.boardVersions[draft.boardId] = c.version + 1;
        }
      }
      recomputeConflictPending(next, action.boardId);
      processQueue(next);
      return next;
    }

    default:
      return state;
  }
}

export function useShop() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const actions = useMemo(
    () => ({
      selectTech: (techId: string) => dispatch({ type: "SELECT_TECH", techId }),
      takeOffline: (boardId: string) => dispatch({ type: "TAKE_OFFLINE", boardId }),
      editDraft: (
        draftId: string,
        section: "profile" | "workOrder" | "damage",
        field: string,
        value: unknown
      ) => dispatch({ type: "EDIT_DRAFT", draftId, section, field, value }),
      submitDraft: (draftId: string) => dispatch({ type: "SUBMIT_DRAFT", draftId }),
      mergeDraft: (draftId: string) => dispatch({ type: "MERGE_DRAFT", draftId }),
      resolveConflict: (
        batchId: string,
        recordType: "profile" | "workOrder" | "damage",
        field: "edgeAngle" | "repairPosition",
        choice: "official" | "offline"
      ) => dispatch({ type: "RESOLVE_CONFLICT", batchId, recordType, field, choice }),
      completeWorkOrder: (workOrderId: string) =>
        dispatch({ type: "COMPLETE_WORKORDER", workOrderId }),
      recalcWorkOrder: (workOrderId: string) =>
        dispatch({ type: "RECALC_WORKORDER", workOrderId }),
      changeBaseline: (newBaseline: number) =>
        dispatch({ type: "CHANGE_BASELINE", newBaseline }),
      retryBatch: (batchId: string) => dispatch({ type: "RETRY_BATCH", batchId }),
      createWorkOrder: (boardId: string) =>
        dispatch({ type: "CREATE_WORKORDER", boardId }),
      simultaneousSubmit: (boardId: string) =>
        dispatch({ type: "SIMULTANEOUS_SUBMIT", boardId }),
    }),
    []
  );

  return { state, actions };
}

export type ShopActions = ReturnType<typeof useShop>["actions"];

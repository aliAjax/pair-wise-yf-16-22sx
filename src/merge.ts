// 三方合并：base（共同祖先）/ official（当前官方）/ offline（离线版）
// 双方都改过同一字段时：
//   - 刃角 edgeAngle、修补位置 repairPosition → 两版都留，标记冲突，选定后才能完工
//   - 其他字段 → 默认留官方版，避免覆盖同事改动

import type {
  BaseDamageRecord,
  Choice,
  FieldConflict,
  MergeRecordResult,
  OfflineDraft,
  SnowboardProfile,
  TuningWorkOrder,
} from "./types";

const HARD_CONFLICT_FIELDS = ["edgeAngle", "repairPosition"] as const;
type HardField = (typeof HARD_CONFLICT_FIELDS)[number];

const FIELD_LABELS: Record<string, string> = {
  edgeAngle: "刃角",
  repairPosition: "修补位置",
};

function isHardConflict(field: string): field is HardField {
  return (HARD_CONFLICT_FIELDS as readonly string[]).includes(field);
}

// 单字段三方合并
function mergeField<T>(
  base: T,
  official: T,
  offline: T
): { value: T | null; conflict: boolean } {
  if (official === base && offline === base) return { value: base, conflict: false };
  if (official === base) return { value: offline, conflict: false };
  if (offline === base) return { value: official, conflict: false };
  if (official === offline) return { value: official, conflict: false };
  return { value: null, conflict: true };
}

interface RecordMergeOutput<T> {
  merged: T;
  conflicts: FieldConflict[];
}

export function mergeRecord<T extends Record<string, unknown>>(
  base: T,
  official: T,
  offline: T
): RecordMergeOutput<T> {
  const merged: Record<string, unknown> = { ...official };
  const conflicts: FieldConflict[] = [];

  for (const key of Object.keys(official)) {
    if (!(key in offline)) continue;
    const bv = base[key];
    const ov = official[key];
    const ofv = offline[key];
    const { value, conflict } = mergeField(bv, ov, ofv);
    if (!conflict) {
      merged[key] = value;
    } else if (isHardConflict(key)) {
      // 刃角 / 修补位置：两版都留，待选定
      merged[key] = null;
      conflicts.push({
        field: key,
        label: FIELD_LABELS[key] ?? key,
        official: ov as number | string,
        offline: ofv as number | string,
        choice: null,
      });
    } else {
      // 其他字段：默认留官方版
      merged[key] = ov;
    }
  }

  return { merged: merged as T, conflicts };
}

// 判断草稿是否已被先到的提交顶掉（乐观并发：baseVersion 对不上）
export function isStaleDraft(draft: OfflineDraft, currentVersion: number): boolean {
  return draft.baseVersion !== currentVersion;
}

export interface CurrentState {
  profile: SnowboardProfile;
  workOrder: TuningWorkOrder;
  damage: BaseDamageRecord;
  version: number;
}

// 合并一整个草稿（雪板档案 / 调校工单 / 底板损伤记录 三条记录）
export function mergeDraft(
  draft: OfflineDraft,
  current: CurrentState
): { results: MergeRecordResult[]; status: "done" | "partial" | "rejected" } {
  // 先到生效：版本对不上 → 整批拒绝
  if (isStaleDraft(draft, current.version)) {
    return {
      status: "rejected",
      results: [
        {
          recordType: "profile",
          recordLabel: "雪板档案",
          recordId: draft.boardId,
          status: "rejected",
          reason: "同事已先提交同一块雪板，先到生效；请重新拉取后再改",
        },
      ],
    };
  }

  const results: MergeRecordResult[] = [];

  // 雪板档案
  {
    const { merged, conflicts } = mergeRecord(
      draft.base.profile as unknown as Record<string, unknown>,
      current.profile as unknown as Record<string, unknown>,
      draft.profile as unknown as Record<string, unknown>
    );
    results.push({
      recordType: "profile",
      recordLabel: "雪板档案",
      recordId: current.profile.id,
      status: conflicts.length > 0 ? "conflict" : "merged",
      conflicts,
      merged,
    });
  }

  // 调校工单
  {
    const { merged, conflicts } = mergeRecord(
      draft.base.workOrder as unknown as Record<string, unknown>,
      current.workOrder as unknown as Record<string, unknown>,
      draft.workOrder as unknown as Record<string, unknown>
    );
    results.push({
      recordType: "workOrder",
      recordLabel: "调校工单",
      recordId: current.workOrder.id,
      status: conflicts.length > 0 ? "conflict" : "merged",
      conflicts,
      merged,
    });
  }

  // 底板损伤记录
  {
    const { merged, conflicts } = mergeRecord(
      draft.base.damage as unknown as Record<string, unknown>,
      current.damage as unknown as Record<string, unknown>,
      draft.damage as unknown as Record<string, unknown>
    );
    results.push({
      recordType: "damage",
      recordLabel: "底板损伤记录",
      recordId: current.damage.id,
      status: conflicts.length > 0 ? "conflict" : "merged",
      conflicts,
      merged,
    });
  }

  const anyConflict = results.some((r) => r.status === "conflict");
  return { status: anyConflict ? "partial" : "done", results };
}

// 选定冲突版本
export function chooseConflict(
  results: MergeRecordResult[],
  recordType: MergeRecordResult["recordType"],
  field: "edgeAngle" | "repairPosition",
  choice: Exclude<Choice, null>
): MergeRecordResult[] {
  return results.map((r) => {
    if (r.recordType !== recordType || !r.conflicts) return r;
    const conflicts = r.conflicts.map((c) =>
      c.field === field ? { ...c, choice } : c
    );
    // 若该记录的硬冲突都已选定，把选定值写回 merged
    const allChosen = conflicts.every((c) => c.choice !== null);
    const merged = { ...(r.merged ?? {}) };
    if (allChosen) {
      for (const c of conflicts) {
        merged[c.field] = c.choice === "official" ? c.official : c.offline;
      }
    }
    return {
      ...r,
      conflicts,
      merged,
      status: conflicts.every((c) => c.choice !== null) ? "merged" : "conflict",
    };
  });
}

// 是否还有未选定的硬冲突
export function hasUnresolvedConflicts(results: MergeRecordResult[]): boolean {
  return results.some(
    (r) => r.status === "conflict" && r.conflicts?.some((c) => c.choice === null)
  );
}

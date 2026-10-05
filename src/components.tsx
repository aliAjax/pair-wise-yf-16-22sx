// 展示组件：指标、技师选择、基线控制、工位排队、工单、雪板档案、底板损伤、合并中心

import { useState } from "react";
import type { ShopActions } from "./useShop";
import type {
  BaseDamageRecord,
  MergeBatch,
  OfflineDraft,
  SnowboardProfile,
  Technician,
  TuningWorkOrder,
} from "./types";
import { STATION_CAPACITY } from "./types";

export interface ShopData {
  boards: SnowboardProfile[];
  workOrders: TuningWorkOrder[];
  damages: BaseDamageRecord[];
  baselineEdgeAngle: number;
  queue: string[];
  drafts: OfflineDraft[];
  batches: MergeBatch[];
  techs: Technician[];
  selectedTechId: string;
}

const STATUS_LABEL: Record<TuningWorkOrder["status"], string> = {
  queued: "排队中",
  active: "施工中",
  completed: "已完工",
};

export function MetricsBar({ data }: { data: ShopData }) {
  const pending = data.workOrders.filter((w) => w.status !== "completed").length;
  const completed = data.workOrders.filter((w) => w.status === "completed").length;
  const active = data.workOrders.filter((w) => w.status === "active");
  const avgEdge =
    active.length > 0
      ? Math.round(active.reduce((s, w) => s + w.edgeAngle, 0) / active.length)
      : 0;
  const repairCount = data.damages.filter((d) => !d.repaired).length;

  const items = [
    { label: "待维护", value: pending },
    { label: "完工工单", value: completed },
    { label: "平均刃角", value: avgEdge },
    { label: "底板修补", value: repairCount },
  ];

  return (
    <section className="metrics">
      {items.map((m) => (
        <article key={m.label}>
          <small>{m.label}</small>
          <strong>{m.value}</strong>
        </article>
      ))}
    </section>
  );
}

export function TechSelect({
  data,
  actions,
}: {
  data: ShopData;
  actions: ShopActions;
}) {
  return (
    <aside className="panel">
      <h2>当前技师</h2>
      <div className="chips">
        {data.techs.map((t) => (
          <button
            key={t.id}
            className={t.id === data.selectedTechId ? "chip-active" : ""}
            onClick={() => actions.selectTech(t.id)}
          >
            {t.name}
          </button>
        ))}
      </div>
      <p className="hint">断网改稿前先选好技师，草稿记在该技师名下。</p>
    </aside>
  );
}

export function BaselineControl({
  data,
  actions,
}: {
  data: ShopData;
  actions: ShopActions;
}) {
  const pending = data.workOrders.filter((w) => w.status !== "completed");
  const completed = data.workOrders.filter((w) => w.status === "completed");
  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>刃角基线</p>
          <h2>基线 {data.baselineEdgeAngle}°</h2>
        </div>
      </div>
      <div className="baseline-row">
        <input
          type="number"
          defaultValue={data.baselineEdgeAngle}
          key={data.baselineEdgeAngle}
          id="baseline-input"
        />
        <button
          className="primary"
          onClick={() => {
            const el = document.getElementById(
              "baseline-input"
            ) as HTMLInputElement | null;
            const v = Number(el?.value);
            if (!Number.isNaN(v)) actions.changeBaseline(v);
          }}
        >
          应用基线
        </button>
      </div>
      <p className="hint">
        基线改动后：<b>未完工 {pending.length} 张</b>方案立即失效重算，
        <b>已完工 {completed.length} 张</b>冻结不变。
      </p>
    </section>
  );
}

export function StationBoard({
  data,
  actions,
}: {
  data: ShopData;
  actions: ShopActions;
}) {
  const active = data.workOrders
    .filter((w) => w.status === "active")
    .sort((a, b) => a.id.localeCompare(b.id));
  const queued = data.queue
    .map((id) => data.workOrders.find((w) => w.id === id))
    .filter((w): w is TuningWorkOrder => !!w);

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>车间工位</p>
          <h2>
            工位 {active.length}/{STATION_CAPACITY}
          </h2>
        </div>
        <button
          onClick={() => data.boards[0] && actions.createWorkOrder(data.boards[0].id)}
          title="工位满后新任务排队"
        >
          新增工单
        </button>
      </div>
      <div className="stations">
        {Array.from({ length: STATION_CAPACITY }).map((_, i) => {
          const w = active[i];
          return (
            <div key={i} className={"station " + (w ? "station-busy" : "")}>
              <span className="station-name">工位 {i + 1}</span>
              {w ? (
                <div className="station-body">
                  <b>{w.id}</b>
                  <span>
                    {w.edgeAngle}° · {w.repairPosition}
                  </span>
                </div>
              ) : (
                <span className="station-empty">空闲</span>
              )}
            </div>
          );
        })}
      </div>
      <h3 className="queue-title">排队中（{queued.length}）</h3>
      <div className="queue">
        {queued.length === 0 && <p className="hint">暂无排队任务。</p>}
        {queued.map((w) => (
          <div key={w.id} className="queue-item">
            <b>{w.id}</b>
            <span>
              {w.edgeAngle}° · {w.repairPosition}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function WorkOrderList({
  data,
  actions,
}: {
  data: ShopData;
  actions: ShopActions;
}) {
  const [filter, setFilter] = useState<"all" | "completed" | "pending">("all");
  const list = data.workOrders
    .filter((w) =>
      filter === "all" ? true : filter === "completed" ? w.status === "completed" : w.status !== "completed"
    )
    .sort((a, b) => a.id.localeCompare(b.id));

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>调校工单</p>
          <h2>工单列表</h2>
        </div>
        <div className="chips">
          <button
            className={filter === "all" ? "chip-active" : ""}
            onClick={() => setFilter("all")}
          >
            全部
          </button>
          <button
            className={filter === "completed" ? "chip-active" : ""}
            onClick={() => setFilter("completed")}
          >
            已完工
          </button>
          <button
            className={filter === "pending" ? "chip-active" : ""}
            onClick={() => setFilter("pending")}
          >
            待维护
          </button>
        </div>
      </div>
      <div className="records">
        {list.map((w) => {
          const board = data.boards.find((b) => b.id === w.boardId);
          const canComplete =
            w.status === "active" && !w.stale && !w.conflictPending;
          return (
            <article key={w.id}>
              <b>{w.id.replace("ORD-", "")}</b>
              <div>
                <h3>
                  {w.id} · {board?.brand ?? w.boardId}
                </h3>
                <p>
                  刃角 {w.edgeAngle}°（基线 {w.baselineAtCreation}°） · 修补{" "}
                  {w.repairPosition} · {w.waxType}
                </p>
                <div className="badges">
                  <span className="badge">{STATUS_LABEL[w.status]}</span>
                  {w.stale && <span className="badge badge-warn">失效·待重算</span>}
                  {w.frozen && <span className="badge badge-freeze">已冻结</span>}
                  {w.conflictPending && (
                    <span className="badge badge-warn">冲突待选定</span>
                  )}
                </div>
                <div className="row-actions">
                  {w.stale && (
                    <button
                      className="primary"
                      onClick={() => actions.recalcWorkOrder(w.id)}
                    >
                      重算刃角
                    </button>
                  )}
                  {w.status !== "completed" && (
                    <button
                      className={canComplete ? "primary" : ""}
                      disabled={!canComplete}
                      title={
                        w.stale
                          ? "方案已失效，请先重算"
                          : w.conflictPending
                            ? "刃角/修补位置冲突未选定，不能完工"
                            : w.status !== "active"
                              ? "工单还在排队，暂不能完工"
                              : ""
                      }
                      onClick={() => actions.completeWorkOrder(w.id)}
                    >
                      完工
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function BoardList({ data }: { data: ShopData }) {
  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>雪板档案</p>
          <h2>档案列表</h2>
        </div>
      </div>
      <div className="records">
        {data.boards.map((b) => (
          <article key={b.id}>
            <b>{b.id.replace("BOARD-", "")}</b>
            <div>
              <h3>
                {b.id} · {b.brand}
              </h3>
              <p>
                {b.boardType} · 长 {b.length}cm · 刃角 {b.edgeAngle}° ·{" "}
                {b.waxType} · 损伤：{b.baseDamage} · 修补：{b.repairPosition} · 偏好：
                {b.customerPreference}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function DamageList({ data }: { data: ShopData }) {
  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>底板损伤</p>
          <h2>损伤记录</h2>
        </div>
      </div>
      <div className="records">
        {data.damages.map((d) => (
          <article key={d.id}>
            <b>{d.id.replace("DMG-", "")}</b>
            <div>
              <h3>
                {d.id} · {d.position}
              </h3>
              <p>
                长 {d.length}cm · 修补位置 {d.repairPosition} ·{" "}
                {d.repaired ? "已修补" : "待修补"}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function TakeOfflinePanel({
  data,
  actions,
}: {
  data: ShopData;
  actions: ShopActions;
}) {
  const [boardId, setBoardId] = useState(data.boards[0]?.id ?? "");
  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>断网改稿</p>
          <h2>带走草稿</h2>
        </div>
      </div>
      <div className="baseline-row">
        <select value={boardId} onChange={(e) => setBoardId(e.target.value)}>
          {data.boards.map((b) => (
            <option key={b.id} value={b.id}>
              {b.id} · {b.brand}
            </option>
          ))}
        </select>
        <button
          className="primary"
          onClick={() => boardId && actions.takeOffline(boardId)}
        >
          为当前技师带走草稿
        </button>
      </div>
      <p className="hint">
        技师在车间断网时把草稿带走修改，回柜台后提交合并。草稿记录带走时的版本，用于先到生效判定。
      </p>
    </section>
  );
}

export function DraftList({
  data,
  actions,
}: {
  data: ShopData;
  actions: ShopActions;
}) {
  const techName = (id: string) => data.techs.find((t) => t.id === id)?.name ?? id;
  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>离线草稿</p>
          <h2>待合并草稿（{data.drafts.length}）</h2>
        </div>
      </div>
      {data.drafts.length === 0 && <p className="hint">暂无草稿。</p>}
      <div className="records">
        {data.drafts.map((d) => (
          <article key={d.id} className="draft-card">
            <b>{techName(d.technicianId)}</b>
            <div>
              <h3>
                {d.id} · {d.boardId}
              </h3>
              <div className="field-grid">
                <label>
                  <span>刃角（工单）</span>
                  <input
                    type="number"
                    value={d.workOrder.edgeAngle}
                    onChange={(e) =>
                      actions.editDraft(
                        d.id,
                        "workOrder",
                        "edgeAngle",
                        Number(e.target.value)
                      )
                    }
                  />
                </label>
                <label>
                  <span>刃角（档案）</span>
                  <input
                    type="number"
                    value={d.profile.edgeAngle}
                    onChange={(e) =>
                      actions.editDraft(
                        d.id,
                        "profile",
                        "edgeAngle",
                        Number(e.target.value)
                      )
                    }
                  />
                </label>
                <label>
                  <span>修补位置（工单）</span>
                  <input
                    value={d.workOrder.repairPosition}
                    onChange={(e) =>
                      actions.editDraft(
                        d.id,
                        "workOrder",
                        "repairPosition",
                        e.target.value
                      )
                    }
                  />
                </label>
                <label>
                  <span>修补位置（损伤）</span>
                  <input
                    value={d.damage.repairPosition}
                    onChange={(e) =>
                      actions.editDraft(
                        d.id,
                        "damage",
                        "repairPosition",
                        e.target.value
                      )
                    }
                  />
                </label>
              </div>
              <div className="row-actions">
                <button onClick={() => actions.submitDraft(d.id)}>提交</button>
                <button
                  className="primary"
                  onClick={() => actions.mergeDraft(d.id)}
                  disabled={d.submittedAt === 0}
                  title={d.submittedAt === 0 ? "请先提交草稿" : ""}
                >
                  合并到柜台
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function BatchList({
  data,
  actions,
}: {
  data: ShopData;
  actions: ShopActions;
}) {
  const techName = (id: string) => data.techs.find((t) => t.id === id)?.name ?? id;
  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>合并历史</p>
          <h2>批次记录</h2>
        </div>
        <button
          onClick={() => data.boards[0] && actions.simultaneousSubmit(data.boards[0].id)}
        >
          模拟同时提交（先到生效）
        </button>
      </div>
      {data.batches.length === 0 && <p className="hint">暂无合并批次。</p>}
      <div className="batches">
        {data.batches.map((b) => (
          <BatchCard
            key={b.id}
            batch={b}
            board={data.boards.find((x) => x.id === b.boardId)}
            techName={techName}
            actions={actions}
          />
        ))}
      </div>
    </section>
  );
}

function BatchCard({
  batch,
  board,
  techName,
  actions,
}: {
  batch: MergeBatch;
  board?: SnowboardProfile;
  techName: (id: string) => string;
  actions: ShopActions;
}) {
  const rejected = batch.status === "rejected";
  const partial = batch.status === "partial";
  return (
    <article
      className={
        "batch " +
        (rejected ? "batch-rejected" : partial ? "batch-partial" : "batch-done")
      }
    >
      <div className="batch-head">
        <div>
          <h3>
            {batch.id} · {batch.boardId} · {techName(batch.technicianId)}
          </h3>
          <p className="hint">
            {new Date(batch.submittedAt).toLocaleTimeString("zh-CN")} 提交 ·{" "}
            {board?.brand}
          </p>
        </div>
        <span
          className={
            "badge " +
            (rejected ? "badge-warn" : partial ? "badge-warn" : "badge-ok")
          }
        >
          {rejected ? "已拒绝" : partial ? "部分合并" : "全部合并"}
        </span>
      </div>

      {rejected && (
        <p className="reject-reason">{batch.results[0]?.reason ?? "合并被拒绝"}</p>
      )}

      <div className="batch-results">
        {batch.results.map((r) => (
          <div key={r.recordType + r.recordId} className="batch-result">
            <div className="batch-result-head">
              <b>{r.recordLabel}</b>
              <span
                className={
                  "badge " +
                  (r.status === "merged"
                    ? "badge-ok"
                    : r.status === "conflict"
                      ? "badge-warn"
                      : "badge-warn")
                }
              >
                {r.status === "merged"
                  ? "已并入"
                  : r.status === "conflict"
                    ? "冲突待选定"
                    : "未并入"}
              </span>
            </div>

            {r.status === "rejected" && r.reason && (
              <p className="reject-reason">{r.reason}</p>
            )}

            {r.status === "conflict" && r.conflicts && (
              <div className="conflicts">
                {r.conflicts.map((c) => (
                  <div key={c.field} className="conflict">
                    <span className="conflict-label">
                      {c.label}冲突，两版都留：
                    </span>
                    <div className="conflict-versions">
                      <button
                        className={
                          c.choice === "official"
                            ? "version version-chosen"
                            : "version"
                        }
                        onClick={() =>
                          actions.resolveConflict(
                            batch.id,
                            r.recordType,
                            c.field,
                            "official"
                          )
                        }
                      >
                        <small>官方版（同事改后）</small>
                        <b>{String(c.official)}</b>
                      </button>
                      <button
                        className={
                          c.choice === "offline"
                            ? "version version-chosen"
                            : "version"
                        }
                        onClick={() =>
                          actions.resolveConflict(
                            batch.id,
                            r.recordType,
                            c.field,
                            "offline"
                          )
                        }
                      >
                        <small>离线版（本人改）</small>
                        <b>{String(c.offline)}</b>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {batch.status !== "done" && (
        <div className="row-actions">
          <button className="primary" onClick={() => actions.retryBatch(batch.id)}>
            重试未并入部分
          </button>
        </div>
      )}
    </article>
  );
}

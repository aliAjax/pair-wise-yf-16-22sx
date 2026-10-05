import { useMemo, useState } from "react";
import {
  addEdge,
  fieldText,
  formatDelta,
  formatEdge,
  initialDraft,
  initialShopState,
  itemStatus,
  STATION_CAPACITY,
  type Edge,
  type LogEntry,
  type MergeField,
  type MergeFieldStatus,
  type MergeItem,
  type MergeResolution,
  type ShopState,
  type WorkOrder,
} from "./shop";
import "./styles.css";

const statusLabels: Record<WorkOrder["status"], string> = {
  active: "工位作业中",
  queued: "容量排队",
  blocked: "同板未生效",
  completed: "已完工",
};

const mergeStatusLabels: Record<MergeFieldStatus, string> = {
  merged: "已并入",
  conflict: "待选定",
  failed: "合并失败",
};

function cloneState(state: ShopState): ShopState {
  return JSON.parse(JSON.stringify(state)) as ShopState;
}

function nowText(): string {
  return new Date().toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function createMergeItems(): MergeItem[] {
  return [
    {
      id: "M-B201",
      entityType: "雪板档案",
      entityId: "B-201",
      boardId: "B-201",
      title: "B-201 / Burton Custom 档案",
      transientFailure: false,
      fields: [
        {
          kind: "wax",
          label: "打蜡类型",
          officialChanged: false,
          workshopChanged: true,
          status: "merged",
          resolution: "workshop",
        },
        {
          kind: "preference",
          label: "客户偏好",
          officialChanged: true,
          workshopChanged: false,
          status: "merged",
          resolution: "official",
        },
      ],
    },
    {
      id: "M-WO201",
      entityType: "调校工单",
      entityId: "WO-201",
      boardId: "B-201",
      title: "WO-201 刃角方案",
      transientFailure: false,
      fields: [
        {
          kind: "edge",
          label: "刃角参数",
          officialChanged: true,
          workshopChanged: true,
          status: "conflict",
        },
      ],
    },
    {
      id: "M-D301",
      entityType: "底板损伤",
      entityId: "D-301",
      boardId: "B-201",
      title: "D-301 板底中段深划痕",
      transientFailure: false,
      fields: [
        {
          kind: "repairLocation",
          label: "修补位置",
          officialChanged: false,
          workshopChanged: true,
          status: "merged",
          resolution: "workshop",
        },
      ],
    },
    {
      id: "M-D302",
      entityType: "底板损伤",
      entityId: "D-302",
      boardId: "B-201",
      title: "D-302 板尾右侧撞击缺材",
      transientFailure: true,
      fields: [
        {
          kind: "repairLocation",
          label: "修补位置",
          officialChanged: false,
          workshopChanged: true,
          status: "failed",
          error: "柜台锁冲突，该项未写入；已并入字段不会重复处理",
        },
      ],
    },
    {
      id: "M-D303",
      entityType: "底板损伤",
      entityId: "D-303",
      boardId: "B-201",
      title: "D-303 板头浅层刮伤",
      transientFailure: false,
      fields: [
        {
          kind: "repairLocation",
          label: "修补位置",
          officialChanged: true,
          workshopChanged: true,
          status: "conflict",
        },
      ],
    },
  ];
}

function getBoard(state: ShopState, boardId: string) {
  return state.boards.find((board) => board.id === boardId);
}

function getOrder(state: ShopState, orderId: string) {
  return state.orders.find((order) => order.id === orderId);
}

function getDamage(state: ShopState, damageId: string) {
  return state.damages.find((damage) => damage.id === damageId);
}

function App() {
  const [state, setState] = useState<ShopState>(() => cloneState(initialShopState));
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: "log-0",
      time: "09:40",
      message: "车间断网；阿澈持有 DRFT-201 离线快照，柜台继续更新正式工单。",
      tone: "info",
    },
  ]);
  const [statusFilter, setStatusFilter] = useState<"all" | WorkOrder["status"]>(
    "all"
  );

  const draft = initialDraft;
  const activeOrders = state.orders.filter((order) => order.status === "active");
  const queuedOrders = state.orders.filter((order) => order.status === "queued");
  const blockedOrders = state.orders.filter(
    (order) => order.status === "blocked"
  );
  const mainOrder = getOrder(state, "WO-201");
  const mainBoard = getBoard(state, "B-201");
  const hasDuplicateDemo = state.orders.some((order) =>
    ["WO-209A", "WO-209B"].includes(order.id)
  );

  const mergeSummary = useMemo(() => {
    if (!state.merge) return null;
    const fields = state.merge.items.flatMap((item) => item.fields);
    return {
      merged: fields.filter((field) => field.status === "merged").length,
      conflicts: fields.filter((field) => field.status === "conflict").length,
      failed: fields.filter((field) => field.status === "failed").length,
    };
  }, [state.merge]);

  const mainReady = Boolean(
    mainBoard &&
      mainOrder &&
      state.merge &&
      mainOrder.status !== "completed" &&
      state.merge.items.every((item) => itemStatus(item) === "merged")
  );

  function pushLog(message: string, tone: LogEntry["tone"] = "info") {
    setLogs((current) => [
      {
        id: `log-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        time: nowText(),
        message,
        tone,
      },
      ...current,
    ]);
  }

  function beginMerge() {
    if (state.merge) return;
    const next = cloneState(state);
    const board = getBoard(next, "B-201");
    const damage301 = getDamage(next, "D-301");
    if (!board || !damage301) return;

    board.wax = draft.profileEdits.wax.value;
    damage301.repairLocation = draft.damageEdits["D-301"].repairLocation;
    damage301.status = "修补中";

    next.merge = {
      draftId: draft.id,
      boardId: "B-201",
      orderId: "WO-201",
      items: createMergeItems(),
    };
    setState(next);
    pushLog(
      "按编号合并 B-201：档案打蜡与 D-301 已并入；刃角、D-303 双方改动，两版保留；D-302 单项失败。",
      "warning"
    );
  }

  function applyResolution(itemId: string, kind: MergeField["kind"], source: MergeResolution) {
    const next = cloneState(state);
    const merge = next.merge;
    const item = merge?.items.find((entry) => entry.id === itemId);
    const field = item?.fields.find((entry) => entry.kind === kind);
    const board = item ? getBoard(next, item.boardId) : undefined;
    const order = item ? getOrder(next, item.entityId) : undefined;
    const damage = item ? getDamage(next, item.entityId) : undefined;
    if (!merge || !item || !field || !board) return;

    if (kind === "wax") {
      board.wax = fieldText(kind, source, next, item, draft);
    }

    if (kind === "preference") {
      board.preference = fieldText(kind, source, next, item, draft);
    }

    if (kind === "edge" && order) {
      order.edgeDelta =
        source === "workshop" ? { ...draft.edgeDelta } : { ...order.counterEdgeDelta };
      order.edgeState = order.status === "completed" ? "frozen" : "planned";
      order.frozenEdge = order.status === "completed"
        ? addEdge(board.baseline, order.edgeDelta)
        : undefined;
    }

    if (kind === "repairLocation" && damage) {
      damage.repairLocation = fieldText(kind, source, next, item, draft);
      damage.status = source === "workshop"
        ? draft.damageEdits[damage.id]?.status ?? damage.status
        : damage.status;
    }

    field.status = "merged";
    field.resolution = source;
    field.error = undefined;
    setState(next);
    pushLog(`${item.entityId} 的「${field.label}」已选定${source === "official" ? "柜台正式版" : "车间离线版"}。`, "success");
  }

  function retryFailed() {
    const next = cloneState(state);
    const merge = next.merge;
    if (!merge) return;

    let retried = 0;
    merge.items.forEach((item) => {
      item.fields.forEach((field) => {
        if (field.status !== "failed") return;
        const damage = getDamage(next, item.entityId);
        if (field.kind === "repairLocation" && damage) {
          damage.repairLocation = fieldText(field.kind, "workshop", next, item, draft);
          damage.status = draft.damageEdits[damage.id]?.status ?? damage.status;
        }
        field.status = "merged";
        field.resolution = "workshop";
        field.error = undefined;
        retried += 1;
      });
    });

    setState(next);
    if (retried > 0) {
      pushLog(`只重试 ${retried} 个未并入字段：D-302 已补写，已并入内容未重复合并。`, "success");
    }
  }

  function recalculateBaseline() {
    const next = cloneState(state);
    const board = getBoard(next, "B-201");
    if (!board) return;

    const oldBaseline = { ...board.baseline };
    const nextBaseline: Edge = { side: 88.5, base: 0.7 };
    board.baseline = nextBaseline;

    const affected = next.orders.filter(
      (order) => order.boardId === "B-201" && order.status !== "completed"
    );

    affected.forEach((order) => {
      order.edgeState = "recalculated";
      order.frozenEdge = undefined;
    });

    const edgeField = next.merge?.items
      .find((item) => item.entityId === "WO-201")
      ?.fields.find((field) => field.kind === "edge");

    if (edgeField) {
      edgeField.status = "conflict";
      edgeField.resolution = undefined;
      edgeField.error = undefined;
    }

    setState(next);
    pushLog(
      `B-201 刃角基线从 ${formatEdge(oldBaseline)} 改为 ${formatEdge(nextBaseline)}；${affected.length} 个未完工方案失效并按原偏移重算，已完工方案冻结。`,
      "warning"
    );
  }

  function promoteQueue(next: ShopState) {
    let promoted = false;
    while (
      next.orders.filter((order) => order.status === "active").length <
        STATION_CAPACITY &&
      !promoted
    ) {
      const nextOrder = next.orders
        .filter((order) => order.status === "queued")
        .sort((a, b) => a.arrival.localeCompare(b.arrival))[0];
      if (!nextOrder) break;
      nextOrder.status = "active";
      nextOrder.blockedReason = undefined;
      promoted = true;
      pushLog(`工位释放，${nextOrder.id} 按 FIFO 从排队进入工位。`, "success");
    }
  }

  function completeOrder(orderId: string) {
    const next = cloneState(state);
    const order = getOrder(next, orderId);
    const board = order ? getBoard(next, order.boardId) : undefined;
    if (!order || !board || order.status === "completed") return;

    if (orderId === "WO-201") {
      if (!next.merge || next.merge.items.some((item) => itemStatus(item) !== "merged")) {
        pushLog("WO-201 不能完工：仍有冲突未选定或失败片段未重试。", "danger");
        return;
      }
    }

    const frozenEdge = addEdge(board.baseline, order.edgeDelta);
    order.status = "completed";
    order.edgeState = "frozen";
    order.frozenEdge = frozenEdge;
    order.completedAt = nowText();

    next.damages = next.damages.map((damage) =>
      damage.boardId === order.boardId
        ? { ...damage, status: "已修补" }
        : damage
    );

    next.completed.unshift({
      ...order,
      wax: board.wax,
      summary:
        orderId === "WO-201"
          ? "离线档案、正式工单、底板损伤记录已按编号合并后完工。"
          : "工位保养完成，刃角结果已冻结。",
    });

    promoteQueue(next);
    setState(next);
    pushLog(
      `${orderId} 完工：最终 ${formatEdge(frozenEdge)} 已冻结；后续基线变化不会改写完工结果。`,
      "success"
    );
  }

  function submitSameBoard() {
    if (hasDuplicateDemo) return;
    const next = cloneState(state);
    const activeCount = next.orders.filter((order) => order.status === "active").length;
    const firstStatus = activeCount >= STATION_CAPACITY ? "queued" : "active";

    next.orders.push(
      {
        id: "WO-209A",
        boardId: "B-209",
        title: "两名技师同时提交：边刃抛光 + 全温蜡",
        technician: "周怡（提交序列 1）",
        arrival: "10:02:15",
        status: firstStatus,
        edgeDelta: { side: 0, base: 0 },
        counterEdgeDelta: { side: 0, base: 0 },
        edgeState: "planned",
      },
      {
        id: "WO-209B",
        boardId: "B-209",
        title: "两名技师同时提交：底板检查",
        technician: "阿澈（提交序列 2）",
        arrival: "10:02:15",
        status: "blocked",
        blockedReason: "同一块雪板已有先到工单，先到版本生效；本单不覆盖数据",
        edgeDelta: { side: 0, base: 0 },
        counterEdgeDelta: { side: 0, base: 0 },
        edgeState: "planned",
      }
    );

    setState(next);
    pushLog(
      firstStatus === "queued"
        ? "B-209 两单同时到达：WO-209A 先到并入容量队列，WO-209B 不生效。"
        : "B-209 两单同时到达：WO-209A 先到进入工位，WO-209B 不生效。",
      "warning"
    );
  }

  function cancelBlocked(orderId: string) {
    const next = cloneState(state);
    const target = getOrder(next, orderId);
    if (!target || target.status !== "blocked") return;
    next.orders = next.orders.filter((order) => order.id !== orderId);
    setState(next);
    pushLog(`${orderId} 已撤回；同板先到工单继续保留，不触发二次合并。`, "info");
  }

  const filteredOrders = state.orders.filter(
    (order) => statusFilter === "all" || order.status === statusFilter
  );

  return (
    <main className="app">
      <section className="hero">
        <div>
          <p>SKI SERVICE MERGE CONSOLE</p>
          <h1>滑雪板旺季合并工作台</h1>
          <span>
            车间离线改单回到柜台后，雪板档案、调校工单、底板损伤记录均按编号合并；刃角和修补位置双方改动时两版保留，选定后才能完工。
          </span>
        </div>
        <div className="hero-rules">
          <b>编号合并不覆盖同事参数</b>
          <b>同板先到生效</b>
          <b>基线变更只重算未完工</b>
        </div>
      </section>

      <section className="metrics">
        <article>
          <small>工位容量</small>
          <strong>{activeOrders.length}/{STATION_CAPACITY}</strong>
          <span>{queuedOrders.length} 单排队，{blockedOrders.length} 单未生效</span>
        </article>
        <article>
          <small>B-201 合并项</small>
          <strong>{state.merge ? `${mergeSummary?.merged}/5` : "未开始"}</strong>
          <span>
            {state.merge
              ? `${mergeSummary?.conflicts} 待选定 · ${mergeSummary?.failed} 失败`
              : "等待柜台执行合并"}
          </span>
        </article>
        <article>
          <small>B-201 刃角基线</small>
          <strong>{mainBoard ? `${mainBoard.baseline.side}°/${mainBoard.baseline.base}°` : "—"}</strong>
          <span>完工冻结，未完工重算</span>
        </article>
        <article>
          <small>已完工历史</small>
          <strong>{state.completed.length}</strong>
          <span>含刃角冻结值和客户记录</span>
        </article>
      </section>

      <section className="toolbar panel">
        <div>
          <p className="eyebrow">离线回柜</p>
          <h2>{draft.id} · {draft.technician} · {draft.cutoff}</h2>
        </div>
        <div className="toolbar-actions">
          <button className="primary" onClick={beginMerge} disabled={Boolean(state.merge)}>
            按编号合并正式工单
          </button>
          <button onClick={recalculateBaseline}>修改 B-201 刃角基线</button>
          <button onClick={submitSameBoard} disabled={hasDuplicateDemo}>
            模拟两名技师同时提交 B-209
          </button>
          {state.merge && mergeSummary && mergeSummary.failed > 0 && (
            <button className="warning" onClick={retryFailed}>
              只重试未并入的 {mergeSummary.failed} 项
            </button>
          )}
        </div>
      </section>

      <section className="workspace-grid">
        <div className="left-column">
          <section className="panel">
            <div className="heading">
              <div>
                <p className="eyebrow">工位容量</p>
                <h2>先到生效与排队</h2>
              </div>
              <div className="chips compact">
                {(["all", "active", "queued", "blocked", "completed"] as const).map((filter) => (
                  <button
                    key={filter}
                    className={statusFilter === filter ? "selected" : ""}
                    onClick={() => setStatusFilter(filter)}
                  >
                    {filter === "all" ? "全部" : statusLabels[filter]}
                  </button>
                ))}
              </div>
            </div>
            <div className="order-list">
              {filteredOrders.map((order) => {
                const board = getBoard(state, order.boardId);
                const target = board ? addEdge(board.baseline, order.edgeDelta) : null;
                return (
                  <article key={order.id} className={`order-card ${order.status}`}>
                    <div className="order-top">
                      <div>
                        <span className="order-id">{order.id}</span>
                        <h3>{board?.id} · {order.title}</h3>
                        <p>{order.technician} · 到达 {order.arrival}</p>
                      </div>
                      <span className={`status ${order.status}`}>{statusLabels[order.status]}</span>
                    </div>
                    {target && (
                      <div className="order-meta">
                        <span>目标刃角：{formatEdge(target)}</span>
                        <span>偏移：{formatDelta(order.edgeDelta)}</span>
                        <span className={order.edgeState}>{order.edgeState === "frozen" ? "已冻结" : order.edgeState === "recalculated" ? "基线后已重算" : "原方案"}</span>
                      </div>
                    )}
                    {order.blockedReason && <p className="block-reason">{order.blockedReason}</p>}
                    <div className="card-actions">
                      <button
                        disabled={order.status !== "active" || (order.id === "WO-201" && !mainReady)}
                        onClick={() => completeOrder(order.id)}
                      >
                        {order.id === "WO-201" ? "选定全部冲突后完工" : "完工冻结"}
                      </button>
                      {order.status === "blocked" && (
                        <button onClick={() => cancelBlocked(order.id)}>撤回未生效单</button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="panel">
            <div className="heading">
              <div>
                <p className="eyebrow">雪板档案</p>
                <h2>按编号维护的正式档案</h2>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>编号</th>
                    <th>客户 / 雪板</th>
                    <th>板型长度</th>
                    <th>刃角基线</th>
                    <th>蜡与偏好</th>
                  </tr>
                </thead>
                <tbody>
                  {state.boards.map((board) => (
                    <tr key={board.id} className={board.id === "B-201" ? "focus-row" : ""}>
                      <td><b>{board.id}</b></td>
                      <td>{board.customer}<span>{board.brand}</span></td>
                      <td>{board.shape}<span>{board.length} cm</span></td>
                      <td>{formatEdge(board.baseline)}</td>
                      <td>{board.wax}<span>{board.preference}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="heading">
              <div>
                <p className="eyebrow">底板损伤标记区</p>
                <h2>损伤与修补记录按损伤编号合并</h2>
              </div>
            </div>
            <div className="damage-grid">
              {state.damages.map((damage) => (
                <article key={damage.id} className={`damage-card status-${damage.status}`}>
                  <span className="order-id">{damage.id}</span>
                  <h3>{damage.title}</h3>
                  <p><b>损伤：</b>{damage.damageLocation}，{damage.lengthCm} cm</p>
                  <p><b>正式修补位置：</b>{damage.repairLocation}</p>
                  <span className="damage-status">{damage.status}</span>
                </article>
              ))}
            </div>
          </section>
        </div>

        <div className="right-column">
          <section className="panel merge-panel">
            <div className="heading">
              <div>
                <p className="eyebrow">合并中心</p>
                <h2>冲突双版本保留</h2>
              </div>
              <span className="merge-count">{state.merge ? "合并会话已建立" : "等待合并"}</span>
            </div>

            {!state.merge && (
              <div className="empty-state">
                <b>离线版 DRFT-201</b>
                <p>柜台正式版与车间版将按 B-201、WO-201、D-301/302/303 编号逐项对齐。单方改动自动并入；双方改动刃角或修补位置时不覆盖，必须人工选定。</p>
              </div>
            )}

            <div className="merge-items">
              {state.merge?.items.map((item) => {
                const aggregate = itemStatus(item);
                return (
                  <article key={item.id} className={`merge-item ${aggregate}`}>
                    <div className="merge-item-head">
                      <div>
                        <span>{item.entityType} · {item.entityId}</span>
                        <h3>{item.title}</h3>
                      </div>
                      <span className={`pill ${aggregate}`}>{mergeStatusLabels[aggregate]}</span>
                    </div>
                    {item.fields.map((field) => (
                      <div key={field.kind} className="field-conflict">
                        <div className="field-title">
                          <b>{field.label}</b>
                          <span className={`pill ${field.status}`}>{mergeStatusLabels[field.status]}</span>
                        </div>
                        {field.error && <p className="error-text">{field.error}</p>}
                        <div className="version-grid">
                          <button
                            className={`version official ${field.resolution === "official" ? "chosen" : ""}`}
                            disabled={field.status === "failed" || field.status === "merged" || (!field.officialChanged && field.kind !== "wax")}
                            onClick={() => applyResolution(item.id, field.kind, "official")}
                          >
                            <span>柜台正式版</span>
                            <b>{fieldText(field.kind, "official", state, item, draft)}</b>
                            {!field.officialChanged && <em>柜台未改，作为基线</em>}
                          </button>
                          <button
                            className={`version workshop ${field.resolution === "workshop" ? "chosen" : ""}`}
                            disabled={field.status === "merged" || !field.workshopChanged}
                            onClick={() => applyResolution(item.id, field.kind, "workshop")}
                          >
                            <span>车间离线版 · {draft.technician}</span>
                            <b>{fieldText(field.kind, "workshop", state, item, draft)}</b>
                            {!field.workshopChanged && <em>车间未改</em>}
                          </button>
                        </div>
                      </div>
                    ))}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="panel">
            <div className="heading">
              <div>
                <p className="eyebrow">客户历史维护记录</p>
                <h2>完工状态筛选 / 已完工冻结</h2>
              </div>
            </div>
            <div className="history-list">
              {state.completed.map((order) => {
                const board = getBoard(state, order.boardId);
                return (
                  <article key={`${order.id}-${order.completedAt}`} className="history-card">
                    <span className="order-id">{order.id} · {order.boardId}</span>
                    <h3>{board?.brand} · {board?.shape}</h3>
                    <p>{order.summary}</p>
                    <div>
                      <span>冻结刃角：{order.frozenEdge ? formatEdge(order.frozenEdge) : "—"}</span>
                      <span>打蜡：{order.wax}</span>
                      <span>完工：{order.completedAt}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="panel log-panel">
            <div className="heading">
              <div>
                <p className="eyebrow">操作审计</p>
                <h2>合并、排队与重算日志</h2>
              </div>
            </div>
            <ul>
              {logs.map((log) => (
                <li key={log.id} className={log.tone}>
                  <time>{log.time}</time>
                  <span>{log.message}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </section>
    </main>
  );
}

export default App;

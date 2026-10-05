export const STATION_CAPACITY = 2;

export type EdgeState = "planned" | "recalculated" | "frozen";
export type OrderStatus = "active" | "queued" | "blocked" | "completed";
export type DamageStatus = "待修补" | "修补中" | "已修补";
export type MergeFieldStatus = "merged" | "conflict" | "failed";
export type MergeResolution = "official" | "workshop";

export interface Edge {
  side: number;
  base: number;
}

export interface BoardProfile {
  id: string;
  customer: string;
  brand: string;
  length: number;
  shape: string;
  baseline: Edge;
  wax: string;
  preference: string;
}

export interface DamageRecord {
  id: string;
  boardId: string;
  title: string;
  damageLocation: string;
  lengthCm: number;
  repairLocation: string;
  status: DamageStatus;
}

export interface WorkOrder {
  id: string;
  boardId: string;
  title: string;
  technician: string;
  arrival: string;
  status: OrderStatus;
  blockedReason?: string;
  edgeDelta: Edge;
  counterEdgeDelta: Edge;
  edgeState: EdgeState;
  frozenEdge?: Edge;
  completedAt?: string;
}

export interface CompletedService {
  wax: string;
  summary: string;
}

export interface FieldEdition {
  value: string;
  changed: boolean;
}

export interface DamageEdition {
  repairLocation: string;
  status: DamageStatus;
  changed: boolean;
}

export interface OfflineDraft {
  id: string;
  boardId: string;
  orderId: string;
  technician: string;
  cutoff: string;
  edgeDelta: Edge;
  profileEdits: {
    wax: FieldEdition;
    preference: FieldEdition;
  };
  damageEdits: Record<string, DamageEdition>;
}

export type MergeEntityType = "雪板档案" | "调校工单" | "底板损伤";
export type MergeFieldKind = "wax" | "preference" | "edge" | "repairLocation";

export interface MergeField {
  kind: MergeFieldKind;
  label: string;
  officialChanged: boolean;
  workshopChanged: boolean;
  status: MergeFieldStatus;
  resolution?: MergeResolution;
  error?: string;
}

export interface MergeItem {
  id: string;
  entityType: MergeEntityType;
  entityId: string;
  boardId: string;
  title: string;
  transientFailure: boolean;
  fields: MergeField[];
}

export interface MergeState {
  draftId: string;
  boardId: string;
  orderId: string;
  items: MergeItem[];
}

export interface ShopState {
  boards: BoardProfile[];
  orders: WorkOrder[];
  damages: DamageRecord[];
  completed: Array<WorkOrder & { boardId: string; wax: string; summary: string }>;
  merge: MergeState | null;
}

export interface LogEntry {
  id: string;
  time: string;
  message: string;
  tone: "info" | "success" | "warning" | "danger";
}

export const initialDraft: OfflineDraft = {
  id: "DRFT-201",
  boardId: "B-201",
  orderId: "WO-201",
  technician: "阿澈",
  cutoff: "09:40 车间断网快照",
  edgeDelta: { side: 0, base: 0.5 },
  profileEdits: {
    wax: { value: "含氟低温竞技蜡", changed: true },
    preference: { value: "弱咬雪，保持板底速度", changed: false },
  },
  damageEdits: {
    "D-301": {
      repairLocation: "板底中心线左移 4mm，62cm 处，P-Tex 细条补",
      status: "修补中",
      changed: true,
    },
    "D-302": {
      repairLocation: "板尾右侧 18cm，P-Tex 点补",
      status: "修补中",
      changed: true,
    },
    "D-303": {
      repairLocation: "板头右侧 10cm，椭圆 P-Tex 贴片",
      status: "修补中",
      changed: true,
    },
  },
};

export const initialShopState: ShopState = {
  boards: [
    {
      id: "B-201",
      customer: "沈先生",
      brand: "Burton Custom",
      length: 156,
      shape: "全地域板",
      baseline: { side: 88, base: 0.5 },
      wax: "低温通用蜡",
      preference: "客户电话确认：刻滑支撑优先（柜台已更新）",
    },
    {
      id: "B-204",
      customer: "赵女士",
      brand: "Salomon GS Race",
      length: 165,
      shape: "竞速板",
      baseline: { side: 87, base: 0.7 },
      wax: "高氟竞速蜡",
      preference: "高速立刃，底刃不要过低",
    },
    {
      id: "B-205",
      customer: "小林",
      brand: "Nitro Cheap Thrills",
      length: 149,
      shape: "公园板",
      baseline: { side: 89, base: 0 },
      wax: "全温蜡",
      preference: "道具容错优先，弱抓雪",
    },
    {
      id: "B-207",
      customer: "April",
      brand: "Capita Kazu Kokubo",
      length: 158,
      shape: "粉雪板",
      baseline: { side: 88, base: 0.5 },
      wax: "粉雪温区蜡",
      preference: "浮力和板底速度优先",
    },
    {
      id: "B-209",
      customer: "周先生",
      brand: "Bataleon Goliath",
      length: 152,
      shape: "公园板",
      baseline: { side: 89, base: 0 },
      wax: "全温蜡",
      preference: "刃口不要太锋利，方便压板",
    },
    {
      id: "B-118",
      customer: "April",
      brand: "Jones Mountain Twin",
      length: 158,
      shape: "粉雪板",
      baseline: { side: 88, base: 0.5 },
      wax: "低温蜡",
      preference: "弱咬雪",
    },
  ],
  orders: [
    {
      id: "WO-201",
      boardId: "B-201",
      title: "刃角重整 + 底板修补 + 打蜡",
      technician: "林岚 / 阿澈",
      arrival: "09:12",
      status: "active",
      edgeDelta: { side: -1, base: -0.25 },
      counterEdgeDelta: { side: -1, base: -0.25 },
      edgeState: "planned",
    },
    {
      id: "WO-204",
      boardId: "B-204",
      title: "竞速赛前精磨",
      technician: "老韩",
      arrival: "09:28",
      status: "active",
      edgeDelta: { side: -1, base: 0 },
      counterEdgeDelta: { side: -1, base: 0 },
      edgeState: "planned",
    },
    {
      id: "WO-205",
      boardId: "B-205",
      title: "公园板除锈打蜡",
      technician: "周怡",
      arrival: "09:36",
      status: "queued",
      edgeDelta: { side: 0, base: 0 },
      counterEdgeDelta: { side: 0, base: 0 },
      edgeState: "planned",
    },
    {
      id: "WO-207",
      boardId: "B-207",
      title: "板底抛光与边刃修整",
      technician: "陈默",
      arrival: "09:44",
      status: "queued",
      edgeDelta: { side: 0, base: 0 },
      counterEdgeDelta: { side: 0, base: 0 },
      edgeState: "planned",
    },
  ],
  damages: [
    {
      id: "D-301",
      boardId: "B-201",
      title: "板底中段深划痕",
      damageLocation: "中心线 62cm 处",
      lengthCm: 8,
      repairLocation: "板底中心线 62cm，P-Tex 条补",
      status: "修补中",
    },
    {
      id: "D-302",
      boardId: "B-201",
      title: "板尾右侧撞击缺材",
      damageLocation: "板尾右侧 18cm",
      lengthCm: 3,
      repairLocation: "待定（等待车间复核点补位置）",
      status: "待修补",
    },
    {
      id: "D-303",
      boardId: "B-201",
      title: "板头浅层刮伤",
      damageLocation: "板头 10–13cm 区间",
      lengthCm: 4,
      repairLocation: "板头左侧 12cm，直径 3cm 贴片",
      status: "修补中",
    },
    {
      id: "D-104",
      boardId: "B-204",
      title: "旧 P-Tex 加固",
      damageLocation: "左脚固定器下方",
      lengthCm: 2,
      repairLocation: "已完成局部加固",
      status: "已修补",
    },
  ],
  completed: [
    {
      id: "WO-118",
      boardId: "B-118",
      title: "粉雪季前保养",
      technician: "林岚",
      arrival: "2026-09-28",
      status: "completed",
      edgeDelta: { side: 0, base: 0 },
      counterEdgeDelta: { side: 0, base: 0 },
      edgeState: "frozen",
      frozenEdge: { side: 88, base: 0.5 },
      completedAt: "2026-09-28",
      wax: "低温蜡",
      summary: "客户偏好弱咬雪；底板划痕 12cm 已完成 P-Tex 修补。",
    },
  ],
  merge: null,
};

export function roundAngle(value: number): number {
  return Math.round(value * 100) / 100;
}

export function addEdge(baseline: Edge, delta: Edge): Edge {
  return {
    side: roundAngle(baseline.side + delta.side),
    base: roundAngle(baseline.base + delta.base),
  };
}

export function formatEdge(edge: Edge): string {
  return `侧刃 ${edge.side}° / 底刃 ${edge.base}°`;
}

export function formatDelta(delta: Edge): string {
  const side = delta.side > 0 ? `+${delta.side}` : `${delta.side}`;
  const base = delta.base > 0 ? `+${delta.base}` : `${delta.base}`;
  return `Δ侧 ${ side }° / Δ底 ${ base }°`;
}

export function targetEdge(board: BoardProfile, order: WorkOrder): Edge {
  return order.frozenEdge ?? addEdge(board.baseline, order.edgeDelta);
}

export function itemStatus(item: MergeItem): MergeFieldStatus {
  if (item.fields.some((field) => field.status === "failed")) return "failed";
  if (item.fields.some((field) => field.status === "conflict")) return "conflict";
  return "merged";
}

export function fieldText(
  kind: MergeFieldKind,
  source: MergeResolution | "applied",
  state: ShopState,
  item: MergeItem,
  draft: OfflineDraft
): string {
  const board = state.boards.find((entry) => entry.id === item.boardId);
  const order = state.orders.find((entry) => entry.id === item.entityId);
  const damage = state.damages.find((entry) => entry.id === item.entityId);

  if (!board) return "—";

  if (kind === "wax") {
    return source === "workshop" ? draft.profileEdits.wax.value : board.wax;
  }

  if (kind === "preference") {
    return source === "workshop"
      ? draft.profileEdits.preference.value
      : board.preference;
  }

  if (kind === "edge" && order) {
    const delta =
      source === "workshop"
        ? draft.edgeDelta
        : source === "official"
          ? order.counterEdgeDelta
          : order.edgeDelta;
    return formatEdge(addEdge(board.baseline, delta));
  }

  if (kind === "repairLocation" && damage) {
    return source === "workshop"
      ? draft.damageEdits[damage.id]?.repairLocation ?? "—"
      : damage.repairLocation;
  }

  return "—";
}

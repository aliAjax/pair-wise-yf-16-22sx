// 滑雪板调校维护系统 —— 数据模型
// 车间断网改稿、柜台合并正式工单的业务场景

// 雪板档案
export interface SnowboardProfile {
  id: string;                 // 编号
  brand: string;              // 品牌
  length: number;             // 长度 cm
  boardType: string;          // 板型：全地域/公园板/竞速板/粉雪板
  edgeAngle: number;          // 刃角（当前计划）
  waxType: string;            // 打蜡类型
  baseDamage: string;         // 底板损伤描述
  repairPosition: string;     // 修补位置
  customerPreference: string;  // 客户偏好
}

// 调校工单状态：排队 / 工位上施工 / 已完工
export type WorkOrderStatus = "queued" | "active" | "completed";

// 调校工单
export interface TuningWorkOrder {
  id: string;                 // 编号
  boardId: string;            // 关联雪板编号
  edgeAngle: number;          // 计划刃角
  edgeAngleOffset: number;    // 相对刃角基线的偏移（重算时保留）
  repairPosition: string;     // 修补位置
  waxType: string;            // 打蜡类型
  status: WorkOrderStatus;
  baselineAtCreation: number; // 创建/重算时的刃角基线
  stale: boolean;             // 基线改动后：未完工方案失效
  frozen: boolean;            // 已完工：冻结，不随基线变动
  // 冲突选定（刃角 / 修补位置 两版都留，选定后才能完工）
  edgeAngleChoice: Choice;
  repairPositionChoice: Choice;
  conflictPending: boolean;   // 存在未解决的刃角/修补位置冲突，禁止完工
}

export type Choice = "official" | "offline" | null;

// 底板损伤记录
export interface BaseDamageRecord {
  id: string;                 // 编号
  boardId: string;            // 关联雪板编号
  position: string;           // 损伤位置
  repairPosition: string;     // 修补位置
  length: number;             // 损伤长度 cm
  repaired: boolean;          // 是否已修补
}

// 工位
export interface Station {
  id: string;
  name: string;
}

// 技师
export interface Technician {
  id: string;
  name: string;
}

// 离线草稿：技师在车间断网时带走的一版数据
export interface OfflineDraft {
  id: string;
  technicianId: string;
  boardId: string;
  createdAt: number;      // 断网带走时间
  submittedAt: number;    // 回柜台提交时间（0 表示尚未提交）
  baseVersion: number;    // 带走时的版本号（先到生效判定）
  base: {                 // 带走时的官方快照（共同祖先）
    profile: SnowboardProfile;
    workOrder: TuningWorkOrder;
    damage: BaseDamageRecord;
  };
  profile: SnowboardProfile;   // 技师改过的雪板档案
  workOrder: TuningWorkOrder;  // 技师改过的调校工单
  damage: BaseDamageRecord;    // 技师改过的底板损伤记录
}

// 字段冲突（刃角 / 修补位置）
export interface FieldConflict {
  field: "edgeAngle" | "repairPosition";
  label: string;
  official: number | string;
  offline: number | string;
  choice: Choice;
}

// 单条记录的合并结果
export interface MergeRecordResult {
  recordType: "profile" | "workOrder" | "damage";
  recordLabel: string;
  recordId: string;
  status: "merged" | "conflict" | "rejected";
  reason?: string;
  conflicts?: FieldConflict[];
  // 合并后落库的值（冲突未选定时为 null）
  merged?: Record<string, unknown>;
}

// 一次合并批次（对应一次柜台提交）
export interface MergeBatch {
  id: string;
  draftId: string;
  boardId: string;
  technicianId: string;
  submittedAt: number;
  status: "done" | "partial" | "rejected";
  results: MergeRecordResult[];
  draft: OfflineDraft;   // 草稿快照，供“只重试没并进去的部分”使用
}

// 工位容量
export const STATION_CAPACITY = 4;

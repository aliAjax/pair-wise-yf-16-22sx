// 初始数据：雪板档案、调校工单、底板损伤记录、技师、工位

import type {
  BaseDamageRecord,
  SnowboardProfile,
  Station,
  Technician,
  TuningWorkOrder,
} from "./types";

export const INITIAL_BASELINE = 88; // 刃角基线 88°

export const technicians: Technician[] = [
  { id: "tech-a", name: "阿哲" },
  { id: "tech-b", name: "老魏" },
  { id: "tech-c", name: "小桐" },
];

export const stations: Station[] = [
  { id: "st-1", name: "工位 1" },
  { id: "st-2", name: "工位 2" },
  { id: "st-3", name: "工位 3" },
  { id: "st-4", name: "工位 4" },
];

export const initialBoards: SnowboardProfile[] = [
  {
    id: "BOARD-001",
    brand: "Burton 156",
    length: 156,
    boardType: "全地域",
    edgeAngle: 88,
    waxType: "低温蜡",
    baseDamage: "底板划痕 12cm",
    repairPosition: "板尾左侧",
    customerPreference: "弱咬雪",
  },
  {
    id: "BOARD-002",
    brand: "竞速板 165",
    length: 165,
    boardType: "竞速板",
    edgeAngle: 87,
    waxType: "高温蜡",
    baseDamage: "底板划痕 8cm",
    repairPosition: "板头右侧",
    customerPreference: "强咬雪",
  },
  {
    id: "BOARD-003",
    brand: "粉雪板 158",
    length: 158,
    boardType: "粉雪板",
    edgeAngle: 89,
    waxType: "低温蜡",
    baseDamage: "底板修补脱落",
    repairPosition: "板腰中央",
    customerPreference: "弱咬雪",
  },
];

export const initialWorkOrders: TuningWorkOrder[] = [
  {
    id: "ORD-106",
    boardId: "BOARD-001",
    edgeAngle: 88,
    edgeAngleOffset: 0,
    repairPosition: "板尾左侧",
    waxType: "低温蜡",
    status: "active",
    baselineAtCreation: INITIAL_BASELINE,
    stale: false,
    frozen: false,
    edgeAngleChoice: null,
    repairPositionChoice: null,
    conflictPending: false,
  },
  {
    id: "ORD-112",
    boardId: "BOARD-002",
    edgeAngle: 87,
    edgeAngleOffset: -1,
    repairPosition: "板头右侧",
    waxType: "高温蜡",
    status: "active",
    baselineAtCreation: INITIAL_BASELINE,
    stale: false,
    frozen: false,
    edgeAngleChoice: null,
    repairPositionChoice: null,
    conflictPending: false,
  },
  {
    id: "ORD-118",
    boardId: "BOARD-003",
    edgeAngle: 89,
    edgeAngleOffset: 1,
    repairPosition: "板腰中央",
    waxType: "低温蜡",
    status: "active",
    baselineAtCreation: INITIAL_BASELINE,
    stale: false,
    frozen: false,
    edgeAngleChoice: null,
    repairPositionChoice: null,
    conflictPending: false,
  },
];

export const initialDamages: BaseDamageRecord[] = [
  {
    id: "DMG-001",
    boardId: "BOARD-001",
    position: "板尾左侧",
    repairPosition: "板尾左侧",
    length: 12,
    repaired: false,
  },
  {
    id: "DMG-002",
    boardId: "BOARD-002",
    position: "板头右侧",
    repairPosition: "板头右侧",
    length: 8,
    repaired: false,
  },
  {
    id: "DMG-003",
    boardId: "BOARD-003",
    position: "板腰中央",
    repairPosition: "板腰中央",
    length: 5,
    repaired: true,
  },
];

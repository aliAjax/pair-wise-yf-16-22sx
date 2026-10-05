import { useShop } from "./useShop";
import {
  BaselineControl,
  BatchList,
  BoardList,
  DamageList,
  DraftList,
  MetricsBar,
  StationBoard,
  TakeOfflinePanel,
  TechSelect,
  WorkOrderList,
} from "./components";
import "./styles.css";

export default function App() {
  const { state, actions } = useShop();

  return (
    <main className="app">
      <section className="hero">
        <p>滑雪板调校维护 · 车间断网改稿 / 柜台合并</p>
        <h1>雪板调校工单合并台</h1>
        <span>
          雪板档案、调校工单、底板损伤记录按编号三方合并；刃角与修补位置冲突两版都留，选定后才能完工；
          两名技师同时提交同一块雪板先到生效；基线改动后未完工方案立即失效重算、已完工冻结；
          工位容量满后新任务排队；合并失败只重试没并进去的部分。
        </span>
      </section>

      <MetricsBar data={state} />

      <section className="workspace">
        <TechSelect data={state} actions={actions} />
        <BaselineControl data={state} actions={actions} />
      </section>

      <section className="workspace">
        <StationBoard data={state} actions={actions} />
        <TakeOfflinePanel data={state} actions={actions} />
      </section>

      <section className="panel">
        <WorkOrderList data={state} actions={actions} />
      </section>

      <section className="workspace">
        <DraftList data={state} actions={actions} />
        <BatchList data={state} actions={actions} />
      </section>

      <section className="workspace">
        <BoardList data={state} />
        <DamageList data={state} />
      </section>
    </main>
  );
}

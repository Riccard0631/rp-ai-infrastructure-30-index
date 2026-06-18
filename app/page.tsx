import IndexDashboard from "@/components/IndexDashboard";
import {
  INDEX_META,
  getBacktestHistory,
  getBacktestSummary,
  getComponents,
  getDataStatus,
  getIndexHistory,
  getIndexMetrics,
  getMetricsForHistory
} from "@/lib/data";

export default function Home() {
  const components = getComponents();
  const launchHistory = getIndexHistory();
  const launchMetrics = getIndexMetrics();
  const backtestHistory = getBacktestHistory();
  const backtestMetrics = getMetricsForHistory(backtestHistory);
  const backtestSummary = getBacktestSummary();
  const dataStatus = getDataStatus();

  return (
    <IndexDashboard
      meta={INDEX_META}
      components={components}
      launchHistory={launchHistory}
      launchMetrics={launchMetrics}
      backtestHistory={backtestHistory}
      backtestMetrics={backtestMetrics}
      backtestSummary={backtestSummary}
      dataStatus={dataStatus}
    />
  );
}

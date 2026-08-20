window.__ModuleLoader__.load({
	id: "dsh-balance",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		//#region dsh-balance/BalanceRow.module.css
		const css = ".db-root{box-sizing:border-box;width:100%;min-width:0;height:42px;color:var(--dsw-alias-label-primary);background:transparent;border:none;border-radius:12px;align-items:center;gap:8px;margin:0 -2px;padding:0 10px 0 8px;font-family:inherit;font-size:14px;line-height:20px;display:inline-flex;overflow:hidden;cursor:pointer;text-align:left}.db-root:hover{background:var(--dsw-alias-interactive-bg-hover)}.db-root:active{background:var(--dsw-alias-interactive-bg-active,var(--dsw-alias-interactive-bg-hover))}.db-rail{width:36px;height:36px;margin:0 auto;padding:0;justify-content:center}.db-icon{flex:none;display:inline-flex;color:var(--dsw-alias-label-tertiary)}.db-label{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden;color:var(--dsw-alias-label-tertiary)}.db-value{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden;font-variant-numeric:tabular-nums;margin-left:auto;flex:none;color:var(--dsw-alias-label-primary)}.db-value[data-state=stale]{opacity:.6}.db-value[data-state=error]{color:var(--dsw-alias-danger-fg,#e5484d)}.db-value[data-state=loading]{color:var(--dsw-alias-label-tertiary)}";
		const tagId = "dsh-balance/BalanceRow.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-balance";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		const styles = {
			"root": "db-root",
			"rail": "db-rail",
			"icon": "db-icon",
			"label": "db-label",
			"value": "db-value"
		};
		//#endregion
		//#region dsh-balance/locales.js
		const NS = "dsh-balance";
		const zh = {
			"label": "API 余额",
			"loading": "查询中…",
			"value.unavailable": "余额不可用",
			"error.missingKey": "未配置 Key",
			"error.generic": "查询失败",
			"hint": "点击刷新 · 双击打开用量页 · 对话完成后自动更新 · 每 30 分钟定时更新"
		};
		const en = {
			"label": "API Balance",
			"loading": "Checking…",
			"value.unavailable": "Balance unavailable",
			"error.missingKey": "No API key",
			"error.generic": "Check failed",
			"hint": "Click to refresh · double-click to open the usage page · updates after each turn · every 30 min"
		};
		//#endregion
		const REFRESH_MS = 30 * 60 * 1000;
		/** Small settle delay after a turn finishes, so the UI calms down before re-querying. */
		const TURN_FINISH_REFRESH_DELAY_MS = 1200;
		function clsx() {
			let out = "";
			for (const arg of arguments) {
				if (!arg) continue;
				if (typeof arg === "string") out += (out ? " " : "") + arg;
			}
			return out;
		}
		/** Fetch the balance through the host route; no API key ever reaches the page. */
		function useBalance() {
			const [snapshot, setSnapshot] = react.useState({ phase: "loading", data: null, error: null });
			const dataRef = react.useRef(null);
			const [tick, setTick] = react.useState(0);
			const refresh = react.useCallback(() => setTick((value) => value + 1), []);
			react.useEffect(() => {
				let cancelled = false;
				const load = async () => {
					try {
						const res = await fetch("/dsh-balance", {
							headers: { accept: "application/json" },
							cache: "no-store"
						});
						if (!res.ok) throw new Error("HTTP " + res.status);
						const data = await res.json();
						dataRef.current = data;
						if (!cancelled) setSnapshot({ phase: "done", data, error: null });
					} catch (error) {
						if (cancelled) return;
						const data = dataRef.current;
						setSnapshot({
							phase: data ? "stale" : "error",
							data,
							error: error instanceof Error ? error.message : String(error)
						});
					}
				};
				load();
				const timer = window.setInterval(() => {
					if (!cancelled) setTick((value) => value + 1);
				}, REFRESH_MS);
				return () => {
					cancelled = true;
					window.clearInterval(timer);
				};
			}, [tick]);
			return { snapshot, refresh };
		}
		/**
		* Refresh once after the current session finishes a full output: the
		* session summary's `running` flag flips true while the model is producing
		* and back to false when the turn completes. Watching the falling edge
		* means "a conversation turn just finished" — exactly the moment the
		* balance should be re-read.
		*/
		function useRefreshOnTurnFinish(useSessions, refresh) {
			const current = useSessions((state) => state.current);
			const running = useSessions((state) => (state.current === void 0 ? void 0 : state.byId[state.current]?.running) === true);
			const prevRunning = react.useRef(false);
			react.useEffect(() => {
				const prev = prevRunning.current;
				prevRunning.current = running;
				if (current === void 0) return;
				if (prev && !running) {
					const timer = window.setTimeout(() => refresh(), TURN_FINISH_REFRESH_DELAY_MS);
					return () => window.clearTimeout(timer);
				}
			}, [running, current, refresh]);
		}
		function currencySymbol(currency) {
			if (currency === "CNY") return "¥";
			if (currency === "USD") return "$";
			return currency ? currency + " " : "";
		}
		function balanceText(data, t) {
			if (data && data.ok === true) {
				const total = data.totalBalance;
				if (typeof total === "string" && total.length > 0) return currencySymbol(data.currency) + total;
				return t("value.unavailable");
			}
			if (data) {
				if (data.error === "missing-api-key") return t("error.missingKey");
				return t("error.generic");
			}
			return t("error.generic");
		}
		/** The DeepSeek platform usage page opened on double-click. */
		const USAGE_URL = "https://platform.deepseek.com/usage";
		/** The sidebar-foot action row: icon + label + balance (wide), icon only (rail). */
		function BalanceRow({ wide, t, subscribeLocale, getLocaleSnapshot, useSessions }) {
			// Re-render on locale switch so live-bound `t` picks up the new language.
			const locale = react.useSyncExternalStore(subscribeLocale, getLocaleSnapshot);
			const { snapshot, refresh } = useBalance();
			// Refresh once after the current conversation finishes a full output.
			useRefreshOnTurnFinish(useSessions, refresh);
			const value = snapshot.phase === "loading" && !snapshot.data ? t("loading") : balanceText(snapshot.data, t);
			const label = t("label");
			const valueState = snapshot.phase === "error" ? "error" : snapshot.phase === "stale" ? "stale" : snapshot.phase === "loading" && !snapshot.data ? "loading" : "ok";
			return react_jsx_runtime.jsx("button", {
				type: "button",
				className: clsx(styles.root, !wide && styles.rail),
				onClick: refresh,
				onDoubleClick: () => {
					window.open(USAGE_URL, "_blank", "noopener,noreferrer");
				},
				title: label + " · " + value + " · " + t("hint"),
				"aria-label": label,
				"data-dsh-balance": snapshot.phase,
				"data-locale": locale.active,
				children: [
					react_jsx_runtime.jsx("span", {
						className: styles.icon,
						children: react_jsx_runtime.jsx(primitives.IconApiOutline14, { size: wide ? 14 : 18 })
					}),
					wide && react_jsx_runtime.jsx("span", {
						className: styles.label,
						children: label
					}),
					wide && react_jsx_runtime.jsx("span", {
						className: styles.value,
						"data-state": valueState,
						children: value
					})
				]
			});
		}
		//#region dsh-balance/index.js
		/** Register the sidebar-foot balance row. */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-balance: dictionaries");
			const t = ctx.locale.bind(NS);
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "dsh-balance",
				order: 50,
				label: () => t("label"),
				locale: NS,
				inject: () => ({
					t,
					subscribeLocale: (callback) => ctx.locale.subscribe(callback),
					getLocaleSnapshot: () => ctx.locale.getSnapshot()
				})
			}, BalanceRow));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = ["slots", "locale"];
		return module.exports;
	}
});

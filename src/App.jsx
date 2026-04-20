import { useState, useMemo } from "react";

// ── マスターデータ ──────────────────────────────────────
const EBAY_CATEGORIES = [
  { label: "その他全般", fee: 12.70 },
  { label: "書籍・映画・音楽", fee: 15.35 },
  { label: "カメラ・レンズ", fee: 9.35 },
  { label: "トレカ", fee: 12.35 },
  { label: "スマホ", fee: 9.35 },
  { label: "タブレット", fee: 9.35 },
  { label: "PC機器", fee: 7.35 },
  { label: "PC周辺機器", fee: 12.70 },
  { label: "時計", fee: 13.00 },
  { label: "アクセサリー", fee: 12.50 },
  { label: "その他楽器", fee: 10.35 },
  { label: "ギター・ベース", fee: 6.70 },
  { label: "ゲーム機本体", fee: 7.35 },
];

const HTS_ITEMS = [
  { label: "ホビー（玩具・フィギュア）", base: 0.00, s301: 7.50 },
  { label: "リール", base: 5.40, s301: 30.40 },
  { label: "デジタルカメラ", base: 0.00, s301: 25.00 },
  { label: "カメラレンズ（フィルター等）", base: 0.00, s301: 25.00 },
  { label: "ランプ", base: 3.50, s301: 28.50 },
  { label: "カバン", base: 3.40, s301: 28.40 },
  { label: "ビデオゲーム機", base: 0.00, s301: 7.50 },
  { label: "腕時計", base: 3.10, s301: 28.10 },
  { label: "メンズ綿の服", base: 14.90, s301: 22.40 },
  { label: "女子の服", base: 8.10, s301: 15.60 },
  { label: "カチューシャ", base: 11.00, s301: 18.50 },
  { label: "SSD", base: 0.00, s301: 0.00 },
  { label: "タオル", base: 0.00, s301: 7.50 },
  { label: "食品の調理用機器", base: 0.00, s301: 25.00 },
  { label: "ボールペン", base: 5.40, s301: 30.40 },
  { label: "万年筆", base: 2.70, s301: 27.70 },
  { label: "筆", base: 0.00, s301: 7.50 },
  { label: "食器・水筒", base: 6.00, s301: 13.50 },
  { label: "ガラス", base: 5.00, s301: 12.50 },
  { label: "革製品", base: 9.00, s301: 34.00 },
  { label: "スリッパ（男性用コットン100%）", base: 48.00, s301: 55.50 },
  { label: "スリッパ（女性用コットン100%）", base: 48.00, s301: 55.50 },
  { label: "綿100%トートバッグ", base: 6.30, s301: 31.30 },
  { label: "クッション", base: 12.80, s301: 20.30 },
  { label: "音響機器", base: 0.00, s301: 25.00 },
  { label: "ヘアピン", base: 5.10, s301: 12.60 },
  { label: "傘", base: 0.00, s301: 7.50 },
  { label: "金属製家具", base: 0.00, s301: 0.00 },
  { label: "靴", base: 20.00, s301: 27.50 },
  { label: "チタン製品", base: 5.50, s301: 5.50 },
  { label: "ランタン（ガラス製）", base: 14.50, s301: 39.50 },
  { label: "車パーツ", base: 3.20, s301: 3.20 },
  { label: "おむつ（コットン）", base: 3.60, s301: 11.10 },
  { label: "楽器$100以下", base: 4.50, s301: 12.00 },
  { label: "その他楽器", base: 8.70, s301: 16.20 },
  { label: "食品用ラップ", base: 4.20, s301: 29.20 },
  { label: "ホッチキス", base: 0.00, s301: 25.00 },
  { label: "手袋（合成繊維製）", base: 2.80, s301: 10.30 },
  { label: "手袋（ポリエステル製）", base: 18.60, s301: 26.10 },
  { label: "スパークプラグ", base: 2.50, s301: 27.50 },
];

const SHIPPING_TABLE = [7, 15, 30, 55, 80, 110];
const DISBURSEMENT = 15;
const MPF = 2.62;
const STATE_TAX = 0.0671;
const VERO_SHIPPING = 10;
const PAYONEER_SPREAD = 3.23;
const S122 = 10;
const PAYONEER_FEE = 0.02;
const CONSUMPTION_TAX = 0.10;
const CONSUMPTION_TAX_RATIO = 10 / 110;

function nearestShipping(tariff) {
  return SHIPPING_TABLE.reduce((prev, curr) =>
    Math.abs(curr - tariff) < Math.abs(prev - tariff) ? curr : prev
  );
}

function calcTariffRate(isChinese, htsItem) {
  if (isChinese) {
    return (S122 + htsItem.s301) / 100;
  } else {
    return (S122 + htsItem.base) / 100;
  }
}

// 希望額から手数料計算
function calcFee(hopeUSD, ebayFeeRate, fx) {
  const b = hopeUSD * (1 + STATE_TAX);
  const categoryFee = b * ebayFeeRate;
  const settleFee = b * 0.0135;
  const tax = (categoryFee + settleFee) * CONSUMPTION_TAX;
  const totalFee = categoryFee + settleFee + tax;
  const taxRefund = tax * fx;
  return { totalFee, taxRefund, tax };
}

// 順算: 希望額→販売額
function calcForward({ hopeUSD, actualShippingUSD, tariffRate, ebayFeeRate, fx }) {
  const tempTariff = (hopeUSD + actualShippingUSD) * tariffRate;
  const selectedShipping = nearestShipping(tempTariff);
  const remaining = hopeUSD - selectedShipping;
  const finalTariff = (remaining + actualShippingUSD) * tariffRate;
  const adjusted = hopeUSD + (finalTariff - selectedShipping);
  const stateTaxAmount = adjusted * STATE_TAX;
  const finalSell = adjusted - stateTaxAmount;
  const veroSell = (finalSell + selectedShipping) - stateTaxAmount;

  // その他経費
  const disbJPY = DISBURSEMENT * fx;
  const mpfJPY = MPF * fx;
  const tariffJPY = finalTariff * fx;
  const otherJPY = disbJPY + mpfJPY + tariffJPY;

  // veroその他経費
  const veroTariff = (hopeUSD + actualShippingUSD) * tariffRate;
  const veroOtherJPY = disbJPY + mpfJPY + (veroTariff * fx);

  return { tempTariff, selectedShipping, remaining, finalTariff, adjusted, stateTaxAmount, finalSell, veroSell, otherJPY, veroOtherJPY };
}

// 利益計算
function calcProfit({ hopeUSD, sellUSD, shippingUSD, actualShippingJPY, purchaseJPY, otherJPY, ebayFeeRate, fwd, fx }) {
  const { totalFee, taxRefund } = calcFee(hopeUSD, ebayFeeRate, fx);
  const a = hopeUSD - totalFee;
  const payoneer = a * PAYONEER_FEE;
  const jpy = (a - payoneer) * (fx - PAYONEER_SPREAD);
  const c = (sellUSD + shippingUSD - hopeUSD) * fx;
  const purchaseRefund = purchaseJPY * CONSUMPTION_TAX_RATIO;
  const grossJPY = (sellUSD + shippingUSD) * fx;
  const profit = jpy + taxRefund + purchaseRefund + c - purchaseJPY - actualShippingJPY - otherJPY;
  const profitRate = (profit / grossJPY) * 100;
  return { profit, profitRate, grossJPY, jpy, taxRefund, purchaseRefund, c, totalFee, a, payoneer };
}

// vero利益計算
function calcVeroProfit({ hopeUSD, veroSellUSD, actualShippingJPY, purchaseJPY, veroOtherJPY, ebayFeeRate, fx }) {
  const { totalFee, taxRefund } = calcFee(hopeUSD, ebayFeeRate, fx);
  const a = hopeUSD - totalFee;
  const payoneer = a * PAYONEER_FEE;
  const jpy = (a - payoneer) * (fx - PAYONEER_SPREAD);
  const purchaseRefund = purchaseJPY * CONSUMPTION_TAX_RATIO;
  const grossJPY = (veroSellUSD + VERO_SHIPPING) * fx;
  const profit = jpy + taxRefund + purchaseRefund - purchaseJPY - actualShippingJPY - veroOtherJPY + VERO_SHIPPING * fx;
  const profitRate = (profit / grossJPY) * 100;
  return { profit, profitRate };
}

// 目標利益率から希望額を二分探索で逆算
function findHopeForTarget({ targetRate, actualShippingUSD, actualShippingJPY, purchaseJPY, ebayFeeRate, tariffRate, fx, maxIter = 80 }) {
  let lo = 1;
  let hi = 2000;

  const evalRate = (hope) => {
    const fwd = calcForward({ hopeUSD: hope, actualShippingUSD, tariffRate, ebayFeeRate, fx });
    const p = calcProfit({ hopeUSD: hope, sellUSD: fwd.finalSell, shippingUSD: fwd.selectedShipping, actualShippingJPY, purchaseJPY, otherJPY: fwd.otherJPY, ebayFeeRate, fwd, fx });
    return p.profitRate;
  };

  for (let i = 0; i < maxIter; i++) {
    const mid = (lo + hi) / 2;
    const rate = evalRate(mid);
    if (Math.abs(rate - targetRate) < 0.01) return mid;
    if (rate < targetRate) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function profitColor(rate) {
  if (rate >= 15) return "#16a34a";
  if (rate >= 8) return "#2563eb";
  if (rate >= 0) return "#d97706";
  return "#dc2626";
}

const fmtD = (n) => n == null ? "-" : "$" + Math.abs(n).toFixed(2);
const fmtY = (n) => "¥" + Math.round(Math.abs(n)).toLocaleString("ja-JP");

export default function EbayRepriceTool() {
  // 入力
  const [sellUSD, setSellUSD] = useState("");
  const [selectedShipping, setSelectedShipping] = useState("");
  const [actualShippingJPY, setActualShippingJPY] = useState("");
  const [origPurchaseJPY, setOrigPurchaseJPY] = useState("");
  const [otherJPY, setOtherJPY] = useState("");
  const [newPurchaseJPY, setNewPurchaseJPY] = useState("");
  const [fx, setFx] = useState("");

  // 品目・カテゴリー
  const [isChinese, setIsChinese] = useState(true);
  const [htsIdx, setHtsIdx] = useState(0);
  const [catIdx, setCatIdx] = useState(0);
  const [manualTariff, setManualTariff] = useState("");
  const [manualFee, setManualFee] = useState("");

  const htsItem = HTS_ITEMS[htsIdx];
  const autTariffRate = calcTariffRate(isChinese, htsItem);
  const tariffRate = manualTariff !== "" ? parseFloat(manualTariff) / 100 : autTariffRate;
  const autoFee = EBAY_CATEGORIES[catIdx].fee;
  const ebayFeeRate = manualFee !== "" ? parseFloat(manualFee) / 100 : autoFee / 100;

  const sell = parseFloat(sellUSD) || 0;
  const selShip = parseFloat(selectedShipping) || 0;
  const actShipJPY = parseFloat(actualShippingJPY) || 0;
  const origPurch = parseFloat(origPurchaseJPY) || 0;
  const other = parseFloat(otherJPY) || 0;
  const newPurch = parseFloat(newPurchaseJPY) || 0;
  const fxRate = parseFloat(fx) || 159;
  const actShipUSD = actShipJPY / fxRate;

  // 逆算
  const derived = useMemo(() => {
    if (!sell || !selShip || !actShipJPY || !other || !fxRate) return null;
    const adjusted = sell / (1 - STATE_TAX);
    const remaining = adjusted - selShip;
    const disbJPY = DISBURSEMENT * fxRate;
    const mpfJPY = MPF * fxRate;
    const finalTariffJPY = other - disbJPY - mpfJPY;
    const finalTariffUSD = finalTariffJPY / fxRate;
    const derivedTariffRate = finalTariffUSD / (remaining + actShipUSD);
    const hopeUSD = adjusted - (finalTariffUSD - selShip);
    return { derivedTariffRate, hopeUSD, finalTariffUSD };
  }, [sell, selShip, actShipJPY, other, fxRate, actShipUSD]);

  // 元の利益
  const origProfit = useMemo(() => {
    if (!derived || !origPurch) return null;
    const fwd = calcForward({ hopeUSD: derived.hopeUSD, actualShippingUSD: actShipUSD, tariffRate, ebayFeeRate, fx: fxRate });
    return calcProfit({ hopeUSD: derived.hopeUSD, sellUSD: sell, shippingUSD: selShip, actualShippingJPY: actShipJPY, purchaseJPY: origPurch, otherJPY: other, ebayFeeRate, fwd, fx: fxRate });
  }, [derived, origPurch, other, tariffRate, ebayFeeRate, fxRate]);

  // 仕入れ差額
  const purchaseDiff = newPurch - origPurch;
  const purchaseDiffUSD = purchaseDiff / fxRate;
  const newHopeUSD = derived ? derived.hopeUSD + purchaseDiffUSD : 0;

  // 新順算
  const newFwd = useMemo(() => {
    if (!derived || !newPurch) return null;
    return calcForward({ hopeUSD: newHopeUSD, actualShippingUSD: actShipUSD, tariffRate, ebayFeeRate, fx: fxRate });
  }, [derived, newPurch, newHopeUSD, actShipUSD, tariffRate, ebayFeeRate, fxRate]);

  // 新利益
  const newProfit = useMemo(() => {
    if (!newFwd || !newPurch) return null;
    return calcProfit({ hopeUSD: newHopeUSD, sellUSD: newFwd.finalSell, shippingUSD: newFwd.selectedShipping, actualShippingJPY: actShipJPY, purchaseJPY: newPurch, otherJPY: newFwd.otherJPY, ebayFeeRate, fwd: newFwd, fx: fxRate });
  }, [newFwd, newPurch, newHopeUSD, actShipJPY, ebayFeeRate, fxRate]);

  // vero利益
  const newVeroProfit = useMemo(() => {
    if (!newFwd || !newPurch) return null;
    return calcVeroProfit({ hopeUSD: newHopeUSD, veroSellUSD: newFwd.veroSell, actualShippingJPY: actShipJPY, purchaseJPY: newPurch, veroOtherJPY: newFwd.veroOtherJPY, ebayFeeRate, fx: fxRate });
  }, [newFwd, newPurch, newHopeUSD, actShipJPY, ebayFeeRate, fxRate]);

  // 目標利益率（3%・5%）
  const target3 = useMemo(() => {
    if (!derived || !newPurch) return null;
    const hope = findHopeForTarget({ targetRate: 3, actualShippingUSD: actShipUSD, actualShippingJPY: actShipJPY, purchaseJPY: newPurch, ebayFeeRate, tariffRate, fx: fxRate });
    const fwd = calcForward({ hopeUSD: hope, actualShippingUSD: actShipUSD, tariffRate, ebayFeeRate, fx: fxRate });
    return { hope, fwd };
  }, [derived, newPurch, actShipUSD, actShipJPY, ebayFeeRate, tariffRate, fxRate]);

  const target5 = useMemo(() => {
    if (!derived || !newPurch) return null;
    const hope = findHopeForTarget({ targetRate: 5, actualShippingUSD: actShipUSD, actualShippingJPY: actShipJPY, purchaseJPY: newPurch, ebayFeeRate, tariffRate, fx: fxRate });
    const fwd = calcForward({ hopeUSD: hope, actualShippingUSD: actShipUSD, tariffRate, ebayFeeRate, fx: fxRate });
    return { hope, fwd };
  }, [derived, newPurch, actShipUSD, actShipJPY, ebayFeeRate, tariffRate, fxRate]);

  const inp = (w) => ({
    border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "8px 10px",
    fontSize: 14, width: w || "100%", outline: "none", background: "#fff",
    fontFamily: "monospace", color: "#1e293b", boxSizing: "border-box",
  });
  const lbl = { fontSize: 10, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4, display: "block", fontWeight: 600 };
  const card = { background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: 18, marginBottom: 14 };
  const sec = { fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 };

  const ResultBox = ({ label, sell, ship, profit, profitRate, otherJPY, color, borderColor }) => (
    <div style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", border: `2px solid ${borderColor || color + "44"}`, marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 10 }}>{label}</div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 9, color: "#94a3b8" }}>販売額</div>
          <div style={{ fontFamily: "monospace", fontSize: 24, fontWeight: 800, color }}>{fmtD(sell)}</div>
        </div>
        <div style={{ fontSize: 18, color: "#94a3b8" }}>+</div>
        <div>
          <div style={{ fontSize: 9, color: "#94a3b8" }}>送料</div>
          <div style={{ fontFamily: "monospace", fontSize: 24, fontWeight: 800, color }}>{fmtD(ship)}</div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: 9, color: "#94a3b8" }}>利益</div>
          <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, color }}>{fmtY(profit)}</div>
          <div style={{ fontFamily: "monospace", fontSize: 14, color }}>{profitRate?.toFixed(2)}%</div>
        </div>
      </div>
      {otherJPY && (
        <div style={{ fontSize: 11, color: "#94a3b8" }}>
          その他経費: <span style={{ fontFamily: "monospace", color: "#475569", fontWeight: 600 }}>{fmtY(otherJPY)}</span>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "sans-serif", color: "#1e293b", padding: "20px 16px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: "#3b82f6", letterSpacing: "0.15em", fontWeight: 700, marginBottom: 3 }}>仕入れ値変動 → 販売価格逆算</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a" }}>eBay Reprice Tool</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>セルスタの数値 + 新仕入れ価格 → 適正販売額を即出力</div>
        </div>

        {/* 品目・カテゴリー設定 */}
        <div style={card}>
          <div style={sec}>品目・カテゴリー設定</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={lbl}>原産国</label>
              <div style={{ display: "flex", gap: 6 }}>
                {["中国", "それ以外"].map((v, i) => (
                  <button key={v} onClick={() => setIsChinese(i === 0)} style={{
                    flex: 1, padding: "8px", borderRadius: 8, border: "1.5px solid",
                    borderColor: isChinese === (i === 0) ? "#3b82f6" : "#e2e8f0",
                    background: isChinese === (i === 0) ? "#eff6ff" : "#fff",
                    color: isChinese === (i === 0) ? "#1d4ed8" : "#94a3b8",
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}>{v}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={lbl}>eBayカテゴリー</label>
              <select value={catIdx} onChange={e => { setCatIdx(+e.target.value); setManualFee(""); }}
                style={{ ...inp(), fontSize: 12 }}>
                {EBAY_CATEGORIES.map((c, i) => <option key={i} value={i}>{c.label} ({c.fee}%)</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={lbl}>品目（HTS）</label>
            <select value={htsIdx} onChange={e => { setHtsIdx(+e.target.value); setManualTariff(""); }}
              style={{ ...inp(), fontSize: 12, marginBottom: 10 }}>
              {HTS_ITEMS.map((h, i) => (
                <option key={i} value={i}>{h.label} — {isChinese ? `${(S122 + h.s301).toFixed(1)}%` : `${(S122 + h.base).toFixed(1)}%`}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={lbl}>関税率 (%) — 手動上書き</label>
              <input type="number" value={manualTariff} step="0.1"
                placeholder={`自動: ${(tariffRate * 100).toFixed(1)}%`}
                onChange={e => setManualTariff(e.target.value)} style={inp()} />
            </div>
            <div>
              <label style={lbl}>eBay手数料 (%) — 手動上書き</label>
              <input type="number" value={manualFee} step="0.01"
                placeholder={`自動: ${(ebayFeeRate * 100).toFixed(2)}%`}
                onChange={e => setManualFee(e.target.value)} style={inp()} />
            </div>
          </div>
          <div style={{ marginTop: 10, background: "#fff", borderRadius: 8, padding: "10px 12px", display: "flex", gap: 16 }}>
            <div style={{ fontSize: 11, color: "#64748b" }}>適用関税率: <span style={{ fontFamily: "monospace", fontWeight: 800, color: "#dc2626", fontSize: 14 }}>{(tariffRate * 100).toFixed(1)}%</span></div>
            <div style={{ fontSize: 11, color: "#64748b" }}>eBay手数料: <span style={{ fontFamily: "monospace", fontWeight: 800, color: "#16a34a", fontSize: 14 }}>{(ebayFeeRate * 100).toFixed(2)}%</span></div>
          </div>
        </div>

        {/* Step1: セルスタの現在数値 */}
        <div style={{ ...card, background: "#eff6ff", borderColor: "#1e3a5f", padding: 0, overflow: "hidden" }}>
          <div style={{ background: "#1e3a5f", padding: "12px 18px" }}>
            <div style={{ color: "#fff", fontSize: 13, fontWeight: 700, letterSpacing: "0.05em" }}>① セルスタの現在数値</div>
          </div>
          <div style={{ padding: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {[
              ["販売額 ($)", sellUSD, setSellUSD],
              ["選択送料 ($)", selectedShipping, setSelectedShipping],
              ["実送料 (¥)", actualShippingJPY, setActualShippingJPY],
              ["その他経費 (¥)", otherJPY, setOtherJPY],
              ["元の仕入れ (¥)", origPurchaseJPY, setOrigPurchaseJPY],
              ["為替 (¥/$)", fx, setFx],
            ].map(([l, val, set]) => (
              <div key={l}>
                <label style={{ ...lbl, color: "#1e3a5f" }}>{l}</label>
                <input type="number" value={val}
                  onChange={e => set(e.target.value)}
                  onFocus={e => { if (e.target.value === "0") set(""); }}
                  style={{ ...inp(), border: "1.5px solid #f59e0b", background: "#fff" }} />
              </div>
            ))}
          </div>
          {derived && (
            <div style={{ marginTop: 12, background: "#f8fafc", borderRadius: 10, padding: "10px 14px", display: "flex", gap: 20, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>逆算された関税率</div>
                <div style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: "#7c3aed" }}>
                  {(derived.derivedTariffRate * 100).toFixed(2)}%
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>元の希望額</div>
                <div style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: "#334155" }}>
                  {fmtD(derived.hopeUSD)}
                </div>
              </div>
              {origProfit && (
                <>
                  <div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>現在の利益</div>
                    <div style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: profitColor(origProfit.profitRate) }}>
                      {fmtY(origProfit.profit)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>現在の利益率</div>
                    <div style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: profitColor(origProfit.profitRate) }}>
                      {origProfit.profitRate.toFixed(2)}%
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          </div>
        </div>

        {/* Step2: 新仕入れ価格 */}
        <div style={{ ...card, borderColor: "#fbbf2488", background: "#fffbeb" }}>
          <div style={sec}>② 新しい仕入れ価格</div>
          <div style={{ maxWidth: 180 }}>
            <label style={{ ...lbl, color: "#b45309" }}>新・仕入れ価格 (¥)</label>
            <input type="number" value={newPurchaseJPY}
              onChange={e => setNewPurchaseJPY(e.target.value)}
              onFocus={e => { if (e.target.value === "0") setNewPurchaseJPY(""); }}
              style={{ ...inp(), border: "2px solid #fbbf24", fontSize: 18, fontWeight: 700 }} />
          </div>
          {newPurch > 0 && origPurch > 0 && purchaseDiff !== 0 && (
            <div style={{ marginTop: 10, fontSize: 12, color: "#92400e", fontFamily: "monospace" }}>
              {fmtY(origPurch)} → {fmtY(newPurch)}
              <span style={{ marginLeft: 8, fontWeight: 700, color: purchaseDiff > 0 ? "#dc2626" : "#16a34a" }}>
                ({purchaseDiff > 0 ? "+" : "-"}{fmtY(purchaseDiff)} / {purchaseDiffUSD > 0 ? "+" : "-"}{fmtD(purchaseDiffUSD)})
              </span>
            </div>
          )}
        </div>

        {/* Step3: 結果 */}
        {newFwd && newProfit && newVeroProfit && (
          <div style={{ ...card, borderColor: "#3b82f644", background: "#eff6ff" }}>
            <div style={sec}>③ 新しい適正販売価格</div>

            <ResultBox
              label="通常出品"
              sell={newFwd.finalSell}
              ship={newFwd.selectedShipping}
              profit={newProfit.profit}
              profitRate={newProfit.profitRate}
              otherJPY={newFwd.otherJPY}
              color="#1d4ed8"
              borderColor="#f59e0b"
            />

            <ResultBox
              label="vero出品"
              sell={newFwd.veroSell}
              ship={VERO_SHIPPING}
              profit={newVeroProfit.profit}
              profitRate={newVeroProfit.profitRate}
              otherJPY={newFwd.veroOtherJPY}
              color="#7c3aed"
              borderColor="#ef4444"
            />

            {/* 目標利益率ライン */}
            <div style={{ marginTop: 14, background: "#f8fafc", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, marginBottom: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>目標利益率ライン</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                    {["目標", "希望額", "販売額", "送料"].map((h, i) => (
                      <th key={h} style={{ padding: "4px 8px", fontSize: 10, color: "#94a3b8", fontWeight: 600, textAlign: i === 0 ? "left" : "right" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[["3%", target3], ["5%", target5]].map(([label, t]) => t && (
                    <tr key={label} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "8px 8px", fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#d97706" }}>{label}</td>
                      <td style={{ padding: "8px 8px", textAlign: "right", fontFamily: "monospace", fontSize: 12, color: "#475569" }}>{fmtD(t.hope)}</td>
                      <td style={{ padding: "8px 8px", textAlign: "right", fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#334155" }}>{fmtD(t.fwd.finalSell)}</td>
                      <td style={{ padding: "8px 8px", textAlign: "right", fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#334155" }}>{fmtD(t.fwd.selectedShipping)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 計算内訳 */}
            <div style={{ marginTop: 10, background: "#f8fafc", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, marginBottom: 8, letterSpacing: "0.08em", textTransform: "uppercase" }}>計算内訳</div>
              {[
                ["新希望額", fmtD(newHopeUSD)],
                ["仮関税", fmtD(newFwd.tempTariff)],
                ["選択送料テーブル", fmtD(newFwd.selectedShipping)],
                ["確定関税", fmtD(newFwd.finalTariff)],
                ["調整後希望額", fmtD(newFwd.adjusted)],
                ["州税 (6.71%)", fmtD(newFwd.stateTaxAmount)],
              ].map(([label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #f1f5f9" }}>
                  <span style={{ fontSize: 11, color: "#64748b" }}>{label}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 12, color: "#334155", fontWeight: 600 }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

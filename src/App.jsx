import { useState, useMemo } from "react";

const SHIPPING_TABLE = [7, 15, 30, 55, 80, 110];
const DISBURSEMENT = 15;
const MPF = 2.62;
const STATE_TAX = 0.0671;
const VERO_SHIPPING = 10;

function nearestShipping(tariff) {
  return SHIPPING_TABLE.reduce((prev, curr) =>
    Math.abs(curr - tariff) < Math.abs(prev - tariff) ? curr : prev
  );
}

function calcForward({ hopeUSD, actualShippingUSD, tariffRate }) {
  // ① 仮関税
  const tempTariff = (hopeUSD + actualShippingUSD) * tariffRate;
  // ② 送料テーブル選択
  const selectedShipping = nearestShipping(tempTariff);
  // ③ 残販売額
  const remaining = hopeUSD - selectedShipping;
  // ④ 確定関税
  const finalTariff = (remaining + actualShippingUSD) * tariffRate;
  // ⑤ 調整後希望額
  const adjusted = hopeUSD + (finalTariff - selectedShipping);
  // ⑥ 州税額
  const stateTaxAmount = adjusted * STATE_TAX;
  // ⑦ 最終販売額
  const finalSell = adjusted - stateTaxAmount;
  // vero
  const veroSell = (finalSell + selectedShipping) - stateTaxAmount;

  return {
    tempTariff,
    selectedShipping,
    remaining,
    finalTariff,
    adjusted,
    stateTaxAmount,
    finalSell,
    veroSell,
  };
}

function deriveFromCurrent({ sellUSD, selectedShipping, actualShippingUSD, otherJPY, fx }) {
  // 逆算: 販売額 → 調整後希望額
  const adjusted = sellUSD / (1 - STATE_TAX);
  // 調整後希望額 - 差額 = 希望額 → 残販売額
  const remaining = adjusted - selectedShipping;
  // 確定関税を逆算
  const disbursementJPY = DISBURSEMENT * fx;
  const mpfJPY = MPF * fx;
  const finalTariffJPY = otherJPY - disbursementJPY - mpfJPY;
  const finalTariffUSD = finalTariffJPY / fx;
  // 関税率
  const tariffRate = finalTariffUSD / (remaining + actualShippingUSD);
  // 元の希望額
  const hopeUSD = adjusted - (finalTariffUSD - selectedShipping);

  return { tariffRate, hopeUSD, finalTariffUSD };
}

function profitColor(rate) {
  if (rate >= 20) return "#16a34a";
  if (rate >= 10) return "#2563eb";
  if (rate >= 0) return "#d97706";
  return "#dc2626";
}

const fmtD = (n) => "$" + Math.abs(n).toFixed(2);
const fmtY = (n) => "¥" + Math.round(Math.abs(n)).toLocaleString("ja-JP");
const sign = (n) => n >= 0 ? "+" : "-";

export default function RepriceCalc() {
  const [sellUSD, setSellUSD] = useState(92);
  const [selectedShipping, setSelectedShipping] = useState(15);
  const [actualShippingUSD, setActualShippingUSD] = useState(23.95);
  const [origPurchaseJPY, setOrigPurchaseJPY] = useState(1700);
  const [otherJPY, setOtherJPY] = useState(5183);
  const [newPurchaseJPY, setNewPurchaseJPY] = useState(2400);
  const [fx, setFx] = useState(158.70);

  // 逆算
  const derived = useMemo(() => deriveFromCurrent({
    sellUSD, selectedShipping, actualShippingUSD, otherJPY, fx,
  }), [sellUSD, selectedShipping, actualShippingUSD, otherJPY, fx]);

  // 仕入れ差額
  const purchaseDiff = newPurchaseJPY - origPurchaseJPY;
  const purchaseDiffUSD = purchaseDiff / fx;

  // 新希望額
  const newHopeUSD = derived.hopeUSD + purchaseDiffUSD;

  // 順算
  const result = useMemo(() => calcForward({
    hopeUSD: newHopeUSD,
    actualShippingUSD,
    tariffRate: derived.tariffRate,
  }), [newHopeUSD, actualShippingUSD, derived.tariffRate]);

  const inp = {
    border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "8px 10px",
    fontSize: 14, width: "100%", outline: "none", background: "#fff",
    fontFamily: "monospace", color: "#1e293b", boxSizing: "border-box",
  };
  const lbl = {
    fontSize: 10, color: "#94a3b8", letterSpacing: "0.08em",
    textTransform: "uppercase", marginBottom: 4, display: "block", fontWeight: 600,
  };
  const card = {
    background: "#fff", border: "1.5px solid #e2e8f0",
    borderRadius: 14, padding: 18, marginBottom: 14,
  };
  const sec = {
    fontSize: 10, fontWeight: 700, color: "#94a3b8",
    letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "sans-serif", color: "#1e293b", padding: "20px 16px" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: "#3b82f6", letterSpacing: "0.15em", fontWeight: 700, marginBottom: 3 }}>
            仕入れ値変動 → 販売価格逆算
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a" }}>eBay Reprice Tool</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
            セルスタの数値 + 新仕入れ価格 → 適正販売額を即出力
          </div>
        </div>

        {/* Step 1 */}
        <div style={card}>
          <div style={sec}>① セルスタの現在数値</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
            {[
              ["販売額 ($)", sellUSD, setSellUSD, 0.01],
              ["選択送料 ($)", selectedShipping, setSelectedShipping, 1],
              ["実送料 ($)", actualShippingUSD, setActualShippingUSD, 0.01],
              ["その他経費 (¥)", otherJPY, setOtherJPY, 1],
              ["元の仕入れ (¥)", origPurchaseJPY, setOrigPurchaseJPY, 1],
              ["為替 (¥/$)", fx, setFx, 0.01],
            ].map(([l, val, set, step]) => (
              <div key={l}>
                <label style={lbl}>{l}</label>
                <input type="number" value={val} step={step}
                  onChange={e => set(parseFloat(e.target.value) || 0)} style={inp} />
              </div>
            ))}
          </div>

          {/* 逆算結果確認 */}
          <div style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 14px", display: "flex", gap: 20, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 10, color: "#94a3b8" }}>逆算された関税率</div>
              <div style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: "#7c3aed" }}>
                {(derived.tariffRate * 100).toFixed(2)}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#94a3b8" }}>元の希望額</div>
              <div style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: "#334155" }}>
                {fmtD(derived.hopeUSD)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#94a3b8" }}>確定関税</div>
              <div style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: "#334155" }}>
                {fmtD(derived.finalTariffUSD)}
              </div>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div style={{ ...card, borderColor: "#fbbf2488", background: "#fffbeb" }}>
          <div style={sec}>② 新しい仕入れ価格</div>
          <div style={{ maxWidth: 180 }}>
            <label style={{ ...lbl, color: "#b45309" }}>新・仕入れ価格 (¥)</label>
            <input type="number" value={newPurchaseJPY} step={1}
              onChange={e => setNewPurchaseJPY(parseFloat(e.target.value) || 0)}
              style={{ ...inp, border: "2px solid #fbbf24", fontSize: 18, fontWeight: 700 }} />
          </div>
          {purchaseDiff !== 0 && (
            <div style={{ marginTop: 10, fontSize: 12, color: "#92400e", fontFamily: "monospace" }}>
              {fmtY(origPurchaseJPY)} → {fmtY(newPurchaseJPY)}
              <span style={{ marginLeft: 8, fontWeight: 700, color: purchaseDiff > 0 ? "#dc2626" : "#16a34a" }}>
                ({sign(purchaseDiff)}{fmtY(purchaseDiff)} / {sign(purchaseDiffUSD)}{fmtD(purchaseDiffUSD)})
              </span>
            </div>
          )}
        </div>

        {/* Step 3: 結果 */}
        <div style={{ ...card, borderColor: "#3b82f644", background: "#eff6ff" }}>
          <div style={sec}>③ 新しい適正販売価格</div>

          {/* 通常 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8, fontWeight: 600 }}>通常出品</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", borderRadius: 12, padding: "14px 18px", border: "1.5px solid #bfdbfe" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>販売額</div>
                <div style={{ fontFamily: "monospace", fontSize: 28, fontWeight: 800, color: "#1d4ed8" }}>
                  {fmtD(result.finalSell)}
                </div>
              </div>
              <div style={{ fontSize: 20, color: "#94a3b8" }}>+</div>
              <div>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>送料</div>
                <div style={{ fontFamily: "monospace", fontSize: 28, fontWeight: 800, color: "#1d4ed8" }}>
                  {fmtD(result.selectedShipping)}
                </div>
              </div>
              <div style={{ fontSize: 20, color: "#94a3b8" }}>=</div>
              <div>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>合計</div>
                <div style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700, color: "#334155" }}>
                  {fmtD(result.finalSell + result.selectedShipping)}
                </div>
              </div>
            </div>
          </div>

          {/* vero */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8, fontWeight: 600 }}>vero出品</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", borderRadius: 12, padding: "14px 18px", border: "1.5px solid #e9d5ff" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>販売額</div>
                <div style={{ fontFamily: "monospace", fontSize: 28, fontWeight: 800, color: "#7c3aed" }}>
                  {fmtD(result.veroSell)}
                </div>
              </div>
              <div style={{ fontSize: 20, color: "#94a3b8" }}>+</div>
              <div>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>送料</div>
                <div style={{ fontFamily: "monospace", fontSize: 28, fontWeight: 800, color: "#7c3aed" }}>
                  {fmtD(VERO_SHIPPING)}
                </div>
              </div>
              <div style={{ fontSize: 20, color: "#94a3b8" }}>=</div>
              <div>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>合計</div>
                <div style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700, color: "#334155" }}>
                  {fmtD(result.veroSell + VERO_SHIPPING)}
                </div>
              </div>
            </div>
          </div>

          {/* 計算内訳 */}
          <div style={{ background: "#f8fafc", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, marginBottom: 8, letterSpacing: "0.08em", textTransform: "uppercase" }}>計算内訳</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {[
                ["新希望額", fmtD(newHopeUSD)],
                ["仮関税", fmtD(result.tempTariff)],
                ["選択送料テーブル", fmtD(result.selectedShipping)],
                ["確定関税", fmtD(result.finalTariff)],
                ["調整後希望額", fmtD(result.adjusted)],
                ["州税 (6.71%)", fmtD(result.stateTaxAmount)],
              ].map(([label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "#64748b" }}>{label}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 12, color: "#334155", fontWeight: 600 }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

import { useCallback, useState } from 'react';

type PriceAnchor = 'unitCost' | 'totalCost' | null;

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface PurchaseLineCalcInitial {
  quantity?: number;
  unitCost?: number;
  totalCost?: number;
}

/**
 * Drives the New Purchase product entry card's three linked fields:
 * quantity, unitCost, totalCost. Only two of the three ever need typing —
 * whichever of unitCost/totalCost the user touched most recently becomes the
 * "anchor" and quantity always recomputes the *other* one from it. Editing
 * quantity itself never changes the anchor, it just re-derives from it.
 *
 *   edit quantity or unitCost → totalCost = quantity × unitCost
 *   edit totalCost            → unitCost  = totalCost ÷ quantity
 */
export function usePurchaseLineCalc(initial?: PurchaseLineCalcInitial) {
  const [quantity, setQuantityText] = useState(initial?.quantity != null ? String(initial.quantity) : '');
  const [unitCost, setUnitCostText] = useState(initial?.unitCost != null ? String(initial.unitCost) : '');
  const [totalCost, setTotalCostText] = useState(initial?.totalCost != null ? String(initial.totalCost) : '');
  const [anchor, setAnchor] = useState<PriceAnchor>(
    initial?.unitCost != null ? 'unitCost' : initial?.totalCost != null ? 'totalCost' : null
  );

  const setQuantity = useCallback((text: string) => {
    setQuantityText(text);
    const q = parseFloat(text);
    if (anchor === 'unitCost') {
      setUnitCostText((uc) => {
        const parsedUc = parseFloat(uc);
        if (!isNaN(q) && !isNaN(parsedUc)) setTotalCostText(String(round2(q * parsedUc)));
        return uc;
      });
    } else if (anchor === 'totalCost') {
      setTotalCostText((tc) => {
        const parsedTc = parseFloat(tc);
        if (!isNaN(q) && q > 0 && !isNaN(parsedTc)) setUnitCostText(String(round2(parsedTc / q)));
        return tc;
      });
    }
  }, [anchor]);

  const setUnitCost = useCallback((text: string) => {
    setUnitCostText(text);
    setAnchor('unitCost');
    const uc = parseFloat(text);
    setQuantityText((q) => {
      const parsedQ = parseFloat(q);
      if (!isNaN(parsedQ) && !isNaN(uc)) setTotalCostText(String(round2(parsedQ * uc)));
      return q;
    });
  }, []);

  const setTotalCost = useCallback((text: string) => {
    setTotalCostText(text);
    setAnchor('totalCost');
    const tc = parseFloat(text);
    setQuantityText((q) => {
      const parsedQ = parseFloat(q);
      if (!isNaN(parsedQ) && parsedQ > 0 && !isNaN(tc)) setUnitCostText(String(round2(tc / parsedQ)));
      return q;
    });
  }, []);

  const reset = useCallback((next?: PurchaseLineCalcInitial) => {
    setQuantityText(next?.quantity != null ? String(next.quantity) : '');
    setUnitCostText(next?.unitCost != null ? String(next.unitCost) : '');
    setTotalCostText(next?.totalCost != null ? String(next.totalCost) : '');
    setAnchor(next?.unitCost != null ? 'unitCost' : next?.totalCost != null ? 'totalCost' : null);
  }, []);

  const parsedQuantity = parseFloat(quantity);
  const parsedUnitCost = parseFloat(unitCost);
  const parsedTotalCost = parseFloat(totalCost);

  return {
    quantity,
    unitCost,
    totalCost,
    anchor,
    setQuantity,
    setUnitCost,
    setTotalCost,
    reset,
    parsedQuantity,
    parsedUnitCost,
    parsedTotalCost,
    isValid:
      !isNaN(parsedQuantity) && parsedQuantity > 0 &&
      !isNaN(parsedUnitCost) && parsedUnitCost >= 0 &&
      !isNaN(parsedTotalCost) && parsedTotalCost >= 0,
  };
}

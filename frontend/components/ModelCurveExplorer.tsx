"use client";

import { useEffect, useState } from "react";
import { getModelCurve } from "@/lib/api";
import { CurveTarget, FeatureWeight, ModelCurve } from "@/lib/types";
import CurveChart from "./CurveChart";

export default function ModelCurveExplorer({
  sport,
  featureOptions,
}: {
  sport: string;
  featureOptions: FeatureWeight[];
}) {
  const [feature, setFeature] = useState(featureOptions[0]?.feature ?? "");
  const [target, setTarget] = useState<CurveTarget>("win");
  const [data, setData] = useState<ModelCurve | null>(null);
  // Derived rather than its own state: avoids a setState-in-effect lint
  // violation, and is naturally always correct (no separate flag to forget
  // to reset) -- "loading" just means "the fetch for the current selection
  // hasn't landed yet."
  const loading = !data || data.feature !== feature || data.target !== target;

  useEffect(() => {
    if (!feature) return;
    let cancelled = false;
    getModelCurve(sport, feature, target).then((result) => {
      if (!cancelled) setData(result);
    });
    return () => {
      cancelled = true;
    };
  }, [sport, feature, target]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-neutral-500">Stat</span>
          <select
            value={feature}
            onChange={(e) => setFeature(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            {featureOptions.map((f) => (
              <option key={f.feature} value={f.feature}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex rounded-md border border-neutral-300 p-0.5 text-sm dark:border-neutral-700">
          {(["win", "margin"] as CurveTarget[]).map((t) => (
            <button
              key={t}
              onClick={() => setTarget(t)}
              className={`rounded px-3 py-1 font-medium transition-colors ${
                target === t
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "text-neutral-600 dark:text-neutral-300"
              }`}
            >
              {t === "win" ? "Win probability" : "Margin"}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-neutral-500">
        {target === "win"
          ? "The logistic regression's fitted S-curve (blue) against real historical games (dots, jittered vertically so wins/losses don't overlap into one line) -- every other stat held at its typical value while this one varies."
          : "The ridge regressor's fitted line (blue, genuinely straight -- ridge is a linear model) against real historical games (dots) -- every other stat held at its typical value while this one varies."}
      </p>

      <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        {loading || !data ? (
          <div className="flex h-[320px] items-center justify-center text-sm text-neutral-400">Loading…</div>
        ) : (
          <CurveChart curve={data.curve} scatter={data.scatter} target={data.target} xLabel={data.label} />
        )}
      </div>
    </div>
  );
}

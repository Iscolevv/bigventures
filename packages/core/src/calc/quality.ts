/**
 * Composite driver quality score (0..1), shown next to trip volume on the
 * incentive dashboard and fed into the incentive engine's quality multiplier.
 */

export interface QualityInputs {
  /** drops that arrived within the customer's expected window */
  onTimeDrops: number;
  totalDrops: number;
  /** drops closed with no damage/shortage/return issue */
  cleanDrops: number;
  /** vehicle checks completed before trip start / trips that required one */
  checksCompleted: number;
  checksRequired: number;
  /** trips with a valid POD on every delivered drop / delivered trips */
  fullyDocumentedTrips: number;
  deliveredTrips: number;
  /** count of confirmed at-fault incidents (accidents, losses) in the period */
  atFaultIncidents: number;
}

export interface QualityScore {
  composite: number;
  components: {
    onTime: number;
    damageFree: number;
    checkCompliance: number;
    podCompliance: number;
    incidentPenalty: number;
  };
}

const WEIGHTS = {
  onTime: 0.3,
  damageFree: 0.3,
  checkCompliance: 0.15,
  podCompliance: 0.25,
} as const;

/** Each confirmed at-fault incident knocks this off the composite. */
const INCIDENT_PENALTY = 0.15;

const ratio = (num: number, den: number, fallback = 1) =>
  den > 0 ? Math.max(0, Math.min(1, num / den)) : fallback;

export function qualityScore(i: QualityInputs): QualityScore {
  const onTime = ratio(i.onTimeDrops, i.totalDrops);
  const damageFree = ratio(i.cleanDrops, i.totalDrops);
  const checkCompliance = ratio(i.checksCompleted, i.checksRequired);
  const podCompliance = ratio(i.fullyDocumentedTrips, i.deliveredTrips);
  const incidentPenalty = Math.min(0.6, i.atFaultIncidents * INCIDENT_PENALTY);

  const weighted =
    onTime * WEIGHTS.onTime +
    damageFree * WEIGHTS.damageFree +
    checkCompliance * WEIGHTS.checkCompliance +
    podCompliance * WEIGHTS.podCompliance;

  const composite = Math.max(0, Math.min(1, weighted - incidentPenalty));

  return {
    composite: round3(composite),
    components: {
      onTime: round3(onTime),
      damageFree: round3(damageFree),
      checkCompliance: round3(checkCompliance),
      podCompliance: round3(podCompliance),
      incidentPenalty: round3(incidentPenalty),
    },
  };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

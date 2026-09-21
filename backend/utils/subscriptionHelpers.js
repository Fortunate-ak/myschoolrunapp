// utils/subscriptionHelpers.js
//
// Single source of truth for "is this guardian allowed to book/track a
// driver right now" under Option 2 — subscription-only, System A's trial
// removed. Any place that needs this check (getProfile, subscribeGuardian,
// createRequest, etc.) should import this rather than re-deriving the
// logic, so they can't drift out of sync.

/**
 * @param {object} guardian - a Guardian model instance or plain object with
 *   isSubscribed (boolean) and subscriptionExpiresAt (Date|string|null)
 * @returns {boolean}
 */
function isGuardianSubscriptionActive(guardian) {
  if (!guardian) return false;
  if (!guardian.isSubscribed) return false;
  if (!guardian.subscriptionExpiresAt) return false;
  return new Date(guardian.subscriptionExpiresAt).getTime() > Date.now();
}

module.exports = { isGuardianSubscriptionActive };
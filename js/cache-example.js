/*
 * Example: replacing a normal fetch() call with PrintUrgeCache.
 *
 * Before:
 *
 *   const response = await fetch("/api/services");
 *   const data = await response.json();
 *
 * After:
 *
 *   const data = await PrintUrgeCache.cachedJson(
 *     "services:list",
 *     "/api/services",
 *     { method: "GET" },
 *     PrintUrgeCache.ttl.tenMinutes
 *   );
 *
 * Manual invalidation:
 *
 *   PrintUrgeCache.clearCache("services:list");
 *   clearCache("services:list");
 *
 * Order status example:
 *
 *   const key = "order-status:" + transactionId + ":" + email.toLowerCase();
 *   const data = await PrintUrgeCache.cachedJson(
 *     key,
 *     "/api/track-order",
 *     {
 *       method: "POST",
 *       headers: { "Content-Type": "application/json" },
 *       body: JSON.stringify({ transaction_id: transactionId, email: email })
 *     },
 *     PrintUrgeCache.ttl.oneMinute
 *   );
 */

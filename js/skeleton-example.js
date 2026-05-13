/*
 * Example: wrapping an existing fetch() call with skeleton show/hide logic.
 *
 * Before:
 *
 *   const response = await fetch("/api/track-order", options);
 *   const data = await response.json();
 *   renderOrder(data.order);
 *
 * After:
 *
 *   const output = document.getElementById("track-order-result");
 *   PrintUrgeSkeleton.orderResult(output);
 *
 *   try {
 *     const response = await fetch("/api/track-order", options);
 *     const data = await response.json();
 *     if (!response.ok) throw new Error(data.error || "Lookup failed");
 *     output.removeAttribute("aria-busy");
 *     renderOrder(data.order);
 *   } catch (err) {
 *     PrintUrgeSkeleton.error(output, "We could not load that order yet. Please try again.");
 *   }
 *
 * Table/list example:
 *
 *   PrintUrgeSkeleton.tableRows("#admin-rows", 6, 8);
 *   const data = await fetch("/api/admin/print-requests").then(r => r.json());
 *   renderRows(data.items);
 */

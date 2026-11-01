export async function onScheduled(event, env, ctx) {

  const domain = "https://testing-for-updates.pages.dev"; 
  await fetch(`${domain}/api/orderbook`, { method: "POST" });
}

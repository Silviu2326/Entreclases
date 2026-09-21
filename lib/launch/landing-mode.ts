// Until the doors open the site wears the prelaunch page: one ask, and as
// little of the product given away as possible. Opening the launch flag brings
// the finished landing back, so nothing else has to be remembered on the day.
// NEXT_PUBLIC_LANDING_MODE forces either one while previewing.
const forced = process.env.NEXT_PUBLIC_LANDING_MODE?.trim();
export const landingMode: "prelaunch" | "full" =
 forced === "prelaunch" || forced === "full" ? forced
 : process.env.NEXT_PUBLIC_LAUNCH_OPEN === "true" ? "full" : "prelaunch";

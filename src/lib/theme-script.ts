// สคริปต์ตั้งธีมก่อนหน้าเว็บแสดงผล (ใส่ใน <head> ของ root layout) กันจอกะพริบสีผิด
// localStorage "theme" = "light" | "dark" | ไม่มี (= ตามเครื่อง)
// สีแถบสถานะ/แถบเบราว์เซอร์ให้ตรงกับพื้นผิวของธีม
export const THEME_COLORS = { light: "#ffffff", dark: "#161920" } as const;

export const THEME_SCRIPT = `(function(){
  var d = document.documentElement;
  var m = window.matchMedia("(prefers-color-scheme: dark)");
  function apply() {
    var c = null;
    try { c = localStorage.getItem("theme"); } catch (e) {}
    var dark = c === "dark" || (c !== "light" && m.matches);
    var t = dark ? "dark" : "light";
    d.setAttribute("data-theme", t);
    d.style.colorScheme = t;
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) metas[i].setAttribute("content", dark ? "${THEME_COLORS.dark}" : "${THEME_COLORS.light}");
  }
  apply();
  window.__applyTheme = apply;
  m.addEventListener("change", apply);
})();`;

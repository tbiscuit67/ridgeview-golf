// Visual-only enhancements for the concept design. Does not touch form logic (script.js owns that).

// Scroll-reveal
const revealEls = document.querySelectorAll(".reveal");
if (revealEls.length) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  revealEls.forEach((el) => io.observe(el));
}

// Mobile hamburger nav — toggles the dropdown, closes when a link is tapped
const navToggle = document.getElementById("nav-toggle");
const siteNav = document.querySelector(".site-nav");
const navLinksEl = document.getElementById("nav-links");
if (navToggle && siteNav && navLinksEl) {
  navToggle.addEventListener("click", () => {
    const open = siteNav.classList.toggle("nav-open");
    navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });
  navLinksEl.querySelectorAll("a").forEach((link) =>
    link.addEventListener("click", () => {
      siteNav.classList.remove("nav-open");
      navToggle.setAttribute("aria-expanded", "false");
      navToggle.setAttribute("aria-label", "Open menu");
    })
  );
}

// Sticky "Register" CTA — appears once the hero has scrolled out of view,
// hides again once the register form itself (or anything after it) is on
// screen so it doesn't float on top of the form/contact section.
const stickyCta = document.getElementById("sticky-cta");
const heroEl = document.querySelector(".hero");
const registerEl = document.getElementById("register");
if (stickyCta && heroEl && registerEl) {
  let heroVisible = true;
  let registerVisible = false;
  const updateStickyCta = () => stickyCta.classList.toggle("show", !heroVisible && !registerVisible);

  new IntersectionObserver(([entry]) => { heroVisible = entry.isIntersecting; updateStickyCta(); }, { threshold: 0 }).observe(heroEl);
  new IntersectionObserver(([entry]) => { registerVisible = entry.isIntersecting; updateStickyCta(); }, { threshold: 0 }).observe(registerEl);
}

window.addEventListener("load", () => {
  const canvas = document.getElementById("mainCanvas");
  const context = canvas.getContext("2d");
  resizeCanvas();

  window.addEventListener("resize", resizeCanvas);

  function resizeCanvas() {
    canvas.width = window.innerWidth - (window.innerWidth >= 768 ? 200 : 0);
    canvas.height =
      window.innerHeight -
      (window.innerWidth < 768
        ? document.querySelector(".toolbar").offsetHeight
        : 0);
  }
});

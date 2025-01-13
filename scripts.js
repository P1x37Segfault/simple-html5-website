window.addEventListener("load", () => {
  /************************/
  /****** Variables *******/
  /************************/

  /** @type {HTMLCanvasElement} */
  const canvas = document.getElementById("playfield");
  /** @type {CanvasRenderingContext2D} */
  const context = canvas.getContext("2d");

  let x = 5; // Ball position
  let y = 5;
  let vx = 0; // Velocity
  let vy = 0;
  let isDragging = false;
  let dragEndX, dragEndY; // Renamed variables
  let lastTime = performance.now();

  const BOUNCE = 0.8; // Bounce coefficient
  const FRICTION = 0.7; // Normal friction
  const BALL_RADIUS = 0.5; // Will be set in resizeCanvas
  const GRASS_FRICTION = 0.95; // Higher friction for slow speeds
  const CRITICAL_SPEED = 2; // Speed threshold where grass friction kicks in
  const MAX_SHOT_SPEED = 42;
  const VELOCITY_THRESHOLD = 0.1; // Threshold for considering ball "stopped"
  const TRAIL_LENGTH = 50; // Number of positions to remember
  const trailPositions = []; // Array to store previous positions
  const AIM_LINE_COLOR = "rgba(255, 255, 255, 0.75)"; // Transparency of aiming line
  const MAX_DRAG_DISTANCE = 4.2; // 5 units based on the 10x10 grid;
  const playerImage = new Image();

  /************************/
  /**** Initial Setup *****/
  /************************/

  playerImage.src = "/assets/golf_ball.png";
  resizeCanvas();
  requestAnimationFrame(gameLoop);

  /**
   * TODO:
   * - add a target to aim for
   * - add obstacles to avoid
   * - add random course generation stuff
   */

  /************************/
  /****** Game Loop *******/
  /************************/

  function gameLoop() {
    updateGame();
    requestAnimationFrame(gameLoop);
  }

  function updateGame() {
    const currentTime = performance.now();
    const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
    lastTime = currentTime;

    context.clearRect(0, 0, canvas.width, canvas.height); // clear canvas
    drawBackground();

    if (!isBallStopped()) {
      handlePhysics(deltaTime);
    }

    if (isDragging) {
      drawShotIndicator();
    }

    drawPlayer();
    updateDebugInfo();
  }

  /************************/
  /******* Physics ********/
  /************************/

  function handlePhysics(deltaTime) {
    const currentSpeed = Math.sqrt(vx * vx + vy * vy);

    // store current position and velocity in trail array
    trailPositions.unshift({ x, y, vx, vy });
    if (trailPositions.length > TRAIL_LENGTH) {
      trailPositions.pop();
    }

    // update position based on velocity
    x += vx * deltaTime;
    y += vy * deltaTime;

    // apply friction i.e. update velocity
    const frameFriction = Math.pow(
      1 - (currentSpeed > CRITICAL_SPEED ? FRICTION : GRASS_FRICTION),
      deltaTime
    );
    vx *= frameFriction;
    vy *= frameFriction;

    // force stop if very slow
    if (currentSpeed < VELOCITY_THRESHOLD) {
      vx = 0;
      vy = 0;
    } else {
      drawTrail();
    }

    // handle wall collisions
    if (x < BALL_RADIUS) {
      x = BALL_RADIUS;
      vx = Math.abs(vx) * BOUNCE;
    }
    if (x > 10 - BALL_RADIUS) {
      x = 10 - BALL_RADIUS;
      vx = -Math.abs(vx) * BOUNCE;
    }
    if (y < BALL_RADIUS) {
      y = BALL_RADIUS;
      vy = Math.abs(vy) * BOUNCE;
    }
    if (y > 10 - BALL_RADIUS) {
      y = 10 - BALL_RADIUS;
      vy = -Math.abs(vy) * BOUNCE;
    }
  }

  function shootBall(dirX, dirY, power) {
    // (dirX, dirY) is a vector pointing from the ball to the drag end, the length should not matter
    const length = Math.sqrt(dirX * dirX + dirY * dirY);
    const normalizedDirX = dirX / length;
    const normalizedDirY = dirY / length;
    const speed = power * MAX_SHOT_SPEED;

    // apply velocity
    vx = normalizedDirX * speed;
    vy = normalizedDirY * speed;

    // clear trail
    trailPositions.length = 0;
  }

  // determine wether the ball is slow enough to be considered stopped
  function isBallStopped() {
    return (
      Math.abs(vx) < VELOCITY_THRESHOLD && Math.abs(vy) < VELOCITY_THRESHOLD
    );
  }

  /************************/
  /****** Rendering *******/
  /************************/

  function drawPlayer() {
    const canvasPos = gridToCanvas(x, y);
    context.save();
    context.translate(canvasPos.x, canvasPos.y);
    const radius = (BALL_RADIUS / 10) * canvas.width;
    context.drawImage(playerImage, -radius, -radius, radius * 2, radius * 2);

    // Add black circle outline
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.strokeStyle = "black";
    context.lineWidth = radius * 0.1;
    context.stroke();

    context.restore();
  }

  function drawTrail() {
    trailPositions.forEach((pos, index) => {
      const alpha = ((TRAIL_LENGTH - index) / TRAIL_LENGTH) * 0.1;
      const canvasPos = gridToCanvas(pos.x, pos.y);

      let radius = (BALL_RADIUS / 10) * canvas.width;
      radius *= 1 - index / TRAIL_LENGTH; // Decreasing size

      context.beginPath();
      context.fillStyle = `rgba(255,255,255,${alpha})`;
      context.arc(canvasPos.x, canvasPos.y, radius, 0, Math.PI * 2);
      context.fill();
    });
  }

  function drawShotIndicator() {
    const dx = x - dragEndX;
    const dy = y - dragEndY;
    const dragDistance = Math.sqrt(dx * dx + dy * dy);

    if (dragDistance < BALL_RADIUS) return;

    const normalizedDistance = Math.min(dragDistance, MAX_DRAG_DISTANCE);
    const displayLength = (normalizedDistance / 10) * canvas.width;
    const radius = (BALL_RADIUS / 10) * canvas.width;
    const dirX = dx / dragDistance;
    const dirY = dy / dragDistance;
    const ARROW_HEAD_SIZE = radius * 1.42;
    const LINE_WIDTH = radius * 0.5;

    // draw line with gradient
    const canvasPos = gridToCanvas(x, y);
    const gradient = context.createLinearGradient(
      canvasPos.x,
      canvasPos.y,
      canvasPos.x + dirX * displayLength,
      canvasPos.y + dirY * displayLength
    );
    gradient.addColorStop(0, "rgba(255, 255, 255, 0)"); // gradient start (transparent)
    gradient.addColorStop(1, AIM_LINE_COLOR); // gradient end
    context.beginPath();
    context.strokeStyle = gradient;
    context.lineWidth = LINE_WIDTH;
    context.moveTo(canvasPos.x, canvasPos.y);
    context.lineTo(
      canvasPos.x + dirX * (displayLength - ARROW_HEAD_SIZE),
      canvasPos.y + dirY * (displayLength - ARROW_HEAD_SIZE)
    );
    context.stroke();

    // draw arrow head
    const angle = Math.atan2(dirY, dirX);
    context.fillStyle = AIM_LINE_COLOR;
    context.beginPath();
    context.moveTo(
      canvasPos.x + dirX * displayLength,
      canvasPos.y + dirY * displayLength
    );
    context.lineTo(
      canvasPos.x +
        dirX * displayLength -
        ARROW_HEAD_SIZE * Math.cos(angle - Math.PI / 6),
      canvasPos.y +
        dirY * displayLength -
        ARROW_HEAD_SIZE * Math.sin(angle - Math.PI / 6)
    );
    context.lineTo(
      canvasPos.x +
        dirX * displayLength -
        ARROW_HEAD_SIZE * Math.cos(angle + Math.PI / 6),
      canvasPos.y +
        dirY * displayLength -
        ARROW_HEAD_SIZE * Math.sin(angle + Math.PI / 6)
    );
    context.closePath();
    context.fill();
  }

  function drawBackground() {
    const tileSize = canvas.width / 10;

    context.fillStyle = "#90EE90"; // Light green
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = "#82DD82"; // Darker green
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        if ((i + j) % 2 === 0) {
          context.fillRect(i * tileSize, j * tileSize, tileSize, tileSize);
        }
      }
    }
  }

  /************************/
  /**** Input Handling ****/
  /************************/

  canvas.addEventListener("mousedown", handleMouseDown);
  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("mouseup", handleMouseUp);
  canvas.addEventListener("touchstart", handleTouchStart);
  canvas.addEventListener("touchmove", handleTouchMove);
  canvas.addEventListener("touchend", handleTouchEnd);

  function handleMouseDown(event) {
    if (!isBallStopped()) return;
    const coords = getCanvasCoordinates(event.clientX, event.clientY);
    handleDragStart(coords.x, coords.y);
  }

  function handleMouseMove(event) {
    const coords = getCanvasCoordinates(event.clientX, event.clientY);
    handleDragMove(coords.x, coords.y);
  }

  function handleMouseUp() {
    handleDragEnd();
  }

  function handleTouchStart(event) {
    if (!isBallStopped()) return;
    event.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const touch = event.touches[0];

    const touchX = (touch.clientX - rect.left) * scaleX;
    const touchY = (touch.clientY - rect.top) * scaleY;
    const gridPos = canvasToGrid(touchX, touchY);

    handleDragStart(gridPos.x, gridPos.y);
  }

  function handleTouchMove(event) {
    event.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const touch = event.touches[0];

    const touchX = (touch.clientX - rect.left) * scaleX;
    const touchY = (touch.clientY - rect.top) * scaleY;
    const gridPos = canvasToGrid(touchX, touchY);

    handleDragMove(gridPos.x, gridPos.y);
  }

  function handleTouchEnd(event) {
    event.preventDefault();
    handleDragEnd();
  }

  function handleDragStart(posX, posY) {
    const distToPlayer = Math.sqrt(
      Math.pow(posX - x, 2) + Math.pow(posY - y, 2)
    );

    if (distToPlayer <= BALL_RADIUS) {
      isDragging = true;
      dragEndX = posX;
      dragEndY = posY;
    }
  }

  function handleDragMove(posX, posY) {
    if (!isDragging) return;
    dragEndX = posX;
    dragEndY = posY;
  }

  function handleDragEnd() {
    if (!isDragging) return;

    const dx = x - dragEndX;
    const dy = y - dragEndY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < BALL_RADIUS) return;

    const normalizedDistance = Math.min(distance, MAX_DRAG_DISTANCE);
    const power = normalizedDistance / MAX_DRAG_DISTANCE;

    isDragging = false;
    shootBall(dx, dy, power);
  }

  /************************/
  /**** UI and Coords *****/
  /************************/

  window.addEventListener("resize", resizeCanvas);
  function resizeCanvas() {
    // Calculate available space (accounting for margins)
    const margin = 80; // 40px padding on each side
    const availableSize = Math.min(
      window.innerWidth - margin,
      window.innerHeight - margin
    );

    canvas.width = availableSize;
    canvas.height = availableSize;
  }

  // Convert grid position to canvas position
  function gridToCanvas(gridX, gridY) {
    return {
      x: (gridX / 10) * canvas.width,
      y: (gridY / 10) * canvas.height,
    };
  }

  // Convert canvas position to grid position
  function canvasToGrid(canvasX, canvasY) {
    return {
      x: (canvasX / canvas.width) * 10,
      y: (canvasY / canvas.height) * 10,
    };
  }

  function getCanvasCoordinates(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return canvasToGrid(
      (clientX - rect.left) * scaleX,
      (clientY - rect.top) * scaleY
    );
  }

  // Debug overlay
  const debugOverlay = document.getElementById("debug-overlay");
  function updateDebugInfo() {
    const posX = x.toFixed(2);
    const posY = y.toFixed(2);
    const velocity = Math.sqrt(vx * vx + vy * vy).toFixed(1);
    debugOverlay.textContent = `Position: [${posX}, ${posY}], Speed: ${velocity}`;
  }
});

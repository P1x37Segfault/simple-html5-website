window.addEventListener("DOMContentLoaded", () => {
  // Potential features one could add:
  // - add sound effects and music
  // - add some nice visual effects (when scoring, hitting obstacles, etc.)
  // - level-editor
  //    - create format to save and load a level
  //    - add UI to load, create, edit and save levels
  // - improve physics
  //    - ball-obstacle collision arround convex corners is buggy
  //    - some ball-wall interactions are unrealistic (ball sometimes loses all velocity)
  // - make the game more challenging
  //    - add more complex obstacles (slopes, ramps, different obstacle shapes, etc.)
  //    - add different surfaces with different friction (ice, sand, etc.)

  /************************/
  /****** Variables *******/
  /************************/

  /** @type {HTMLCanvasElement} */
  const canvas = document.getElementById("playfield");
  /** @type {CanvasRenderingContext2D} */
  const context = canvas.getContext("2d");

  /** @type {HTMLCanvasElement} */
  const offscreenCanvas = document.createElement("canvas");
  /** @type {CanvasRenderingContext2D} */
  const offscreenContext = offscreenCanvas.getContext("2d");

  let targetPos = { x: 2, y: 2 };
  let playerPos = { x: 7.5, y: 7.5 };
  let playerVelocity = { x: 0, y: 0 };
  let isDragging = false;
  let dragPos = { x: 0, y: 0 };
  let hasHitTarget = false;
  let playerOpacity = 1.0;
  let remainingShots = 0;
  let isBallStopped = true;
  let isGameRunning = true;
  let level = 1;
  let obstacles = [];
  let initialRenderPass = true;
  let lastTime = performance.now();
  let invertAimDirection = false;
  let animationAngle = 0;
  let hasSeenTutorial = false;

  const BOUNCE = 0.95;
  const FRICTION = 0.7;
  const BALL_RADIUS = 0.42;
  const TARGET_RADIUS = 0.75;
  const TARGET_PULL_FORCE = 30;
  const GRASS_FRICTION = 0.95;
  const CRITICAL_SPEED = 2;
  const MAX_SHOT_SPEED = 25;
  const VELOCITY_THRESHOLD = 0.1;
  const TARGET_THRESHOLD = 0.2;
  const TRAIL_LENGTH = 42;
  const trailPositions = [];
  const SHOT_IND_COLOR = "rgba(255, 255, 255, 0.75)";
  const MAX_DRAG_DISTANCE = 4.2;
  const playerImage = new Image();
  const SHOTS_PER_LEVEL = 3;
  const MAX_NUM_OBSTACLES = 10;
  const TARGET_FRAME_RATE = 60;
  const PLAYER_FADEOUT_SPEED = 4.2;
  const CANVAS_MARGIN = 50;
  const ANIMATION_ROTATION_SPEED = 0.5;

  const tutorialOverlay = document.getElementById("tutorial-overlay");
  const hideTutorialBtn = document.getElementById("hide-tutorial");
  const gameOverOverlay = document.getElementById("overlay");
  const gameOverlayMsg = document.getElementById("overlay-message");
  const restartBtn = document.getElementById("restart-button");
  const restartGameBtn = document.getElementById("restart-game");
  const continueBtn = document.getElementById("next-button");
  const remainingShotsDiv = document.getElementById("remaining-shots");
  const currentLevelDisplay = document.getElementById("current-level");
  const toggleAimDirBtn = document.getElementById("toggle-aim-direction");

  /************************/
  /**** Initial Setup *****/
  /************************/

  restartBtn.addEventListener("click", gameOver);
  restartGameBtn.addEventListener("click", gameOver);
  continueBtn.addEventListener("click", nextLevel);
  toggleAimDirBtn.addEventListener("click", toggleInputDirection);
  hideTutorialBtn.addEventListener("click", hideTutorial);
  remainingShots = SHOTS_PER_LEVEL;
  playerImage.src = "./assets/golf_ball.png";
  resizeCanvas();
  restartGame();
  requestAnimationFrame(gameLoop); // start game loop
  loadLocalStorage();
  showTutorial();

  function loadLocalStorage() {
    if (localStorage.getItem("hasSeenTutorial") !== null) {
      const timestamp = localStorage.getItem("hasSeenTutorial");
      const currentTime = new Date().getTime();

      // if the tutorial was seen more than 24 hours ago, show it again
      const oneDayInMilliseconds = 24 * 60 * 60 * 1000;
      if (currentTime - timestamp > oneDayInMilliseconds) {
        hasSeenTutorial = false;
      } else {
        hasSeenTutorial = true;
      }

      hasSeenTutorial = true;
    } else {
      hasSeenTutorial = false;
    }
  }

  function showTutorial() {
    if (hasSeenTutorial) return;
    tutorialOverlay.classList.remove("hidden");
  }

  function hideTutorial() {
    localStorage.setItem("hasSeenTutorial", new Date().getTime());
    hasSeenTutorial = true;
    tutorialOverlay.classList.add("hidden");
  }

  /************************/
  /****** Game Loop *******/
  /************************/

  function gameLoop(currentTime) {
    if (currentTime - lastTime < 500 / TARGET_FRAME_RATE) {
      requestAnimationFrame(gameLoop);
      // this is kind of cursed but it works
      // this way the framerate stays somewhat consistent at 60fps
      return;
    }

    const deltaTime = (currentTime - lastTime) / 1000;
    updateGame(deltaTime);
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
  }

  function updateGame(deltaTime) {
    isBallStopped = playerVelocity.x == 0 && playerVelocity.y == 0;

    if (!isGameRunning) {
      return; // save some ressources
    }

    context.clearRect(0, 0, canvas.width, canvas.height); // clear canvas
    context.drawImage(offscreenCanvas, 0, 0); // draw static elements

    if (hasHitTarget) {
      if (playerOpacity > 0.01) {
        playerOpacity -= PLAYER_FADEOUT_SPEED * deltaTime;
      } else {
        isGameRunning = false;
        gameOverOverlay.classList.remove("hidden");
        gameOverlayMsg.textContent = "Level Complete!";
        restartBtn.classList.add("hidden");
        continueBtn.classList.remove("hidden");
      }
    } else {
      if (playerOpacity <= 1) {
        playerOpacity = 1;
      }

      if (!isBallStopped) {
        drawTrail();
        handlePhysics(deltaTime);
      } else {
        if (remainingShots === 0) {
          isGameRunning = false;
          gameOverOverlay.classList.remove("hidden");
          gameOverlayMsg.textContent = "Game Over!";
          restartBtn.classList.remove("hidden");
          continueBtn.classList.add("hidden");
        }
      }

      if (isDragging) {
        drawShotIndicator();
      } else if (isBallStopped) {
        drawReadyAnimation(deltaTime);
      }
    }

    if (!initialRenderPass) {
      initialRenderPass = false;
      // wait for the player image to load
      setTimeout(() => {
        drawPlayer();
      }, 500);
    } else {
      if (playerOpacity > 0) {
        drawPlayer();
      }
    }
  }

  function generateLevel() {
    // target
    targetPos = {
      x: 1 + Math.floor(Math.random() * 9),
      y: 1 + Math.floor(Math.random() * 9),
    };

    // player
    let isValidPosition = false;

    while (!isValidPosition) {
      playerPos = {
        x: 1.5 + Math.floor(Math.random() * 8),
        y: 1.5 + Math.floor(Math.random() * 8),
      };

      const distanceToTarget = Math.sqrt(
        Math.pow(playerPos.x - targetPos.x, 2) +
          Math.pow(playerPos.y - targetPos.y, 2)
      );

      const intersectsWall =
        playerPos.x < BALL_RADIUS ||
        playerPos.x > 10 - BALL_RADIUS ||
        playerPos.y < BALL_RADIUS ||
        playerPos.y > 10 - BALL_RADIUS;

      isValidPosition =
        distanceToTarget >= MAX_DRAG_DISTANCE && !intersectsWall;
    }

    // obstacles
    obstacles = [];
    const maxObstacles = Math.min(Math.ceil(level - 1), MAX_NUM_OBSTACLES);
    const maxObstacleSize = Math.min(level, 5);
    for (let i = 0; i < maxObstacles; i++) {
      let obstacle;
      let isValidPosition = false;

      for (let attempts = 0; attempts < 10; attempts++) {
        const size = 1 + Math.floor(Math.random() * maxObstacleSize);
        const isVertical = Math.random() < 0.5;
        obstacle = {
          x: Math.floor(Math.random() * 10),
          y: Math.floor(Math.random() * 10),
          width: isVertical ? 1 : size,
          height: isVertical ? size : 1,
        };

        const targetSquare = {
          x: targetPos.x - TARGET_RADIUS,
          y: targetPos.y - TARGET_RADIUS,
          width: TARGET_RADIUS * 2,
          height: TARGET_RADIUS * 2,
        };

        const intersectsObstacle =
          playerPos.x + BALL_RADIUS > obstacle.x &&
          playerPos.x - BALL_RADIUS < obstacle.x + obstacle.width &&
          playerPos.y + BALL_RADIUS > obstacle.y &&
          playerPos.y - BALL_RADIUS < obstacle.y + obstacle.height;

        isValidPosition =
          obstacle.x + obstacle.width < targetSquare.x ||
          obstacle.x > targetSquare.x + targetSquare.width ||
          obstacle.y + obstacle.height < targetSquare.y ||
          obstacle.y > targetSquare.y + targetSquare.height;

        if (isValidPosition && !intersectsObstacle) {
          obstacles.push(obstacle);
          break;
        }
      }
    }
  }

  function restartGame() {
    generateLevel();
    drawStaticElements();
    playerVelocity = { x: 0, y: 0 };
    isDragging = false;
    dragPos = { x: 0, y: 0 };
    hasHitTarget = false;
    playerOpacity = 1.0;
    remainingShots = SHOTS_PER_LEVEL;
    isBallStopped = true;
    isGameRunning = true;
    lastTime = performance.now();
    gameOverOverlay.classList.add("hidden");
    updateRemainingShots();
    updateLevelUI();
    requestAnimationFrame(gameLoop);
  }

  function nextLevel() {
    level++;
    restartGame();
  }

  function gameOver() {
    level = 1;
    let isAlreadyRotated = restartGameBtn.classList.contains("rotated");
    restartGameBtn.classList.toggle("rotated");
    restartGameBtn.children[0].textContent = isAlreadyRotated ? "↻" : "↺";
    restartGame();
  }

  /************************/
  /******* Physics ********/
  /************************/

  function handlePhysics(deltaTime) {
    const currentSpeed = Math.sqrt(
      playerVelocity.x * playerVelocity.x + playerVelocity.y * playerVelocity.y
    );

    // store current position and velocity in trail array
    trailPositions.unshift({ ...playerPos });
    if (trailPositions.length > TRAIL_LENGTH) {
      trailPositions.pop();
    }

    // update position based on velocity
    playerPos.x += playerVelocity.x * deltaTime;
    playerPos.y += playerVelocity.y * deltaTime;

    // apply friction
    const frameFriction = Math.pow(
      1 - (currentSpeed > CRITICAL_SPEED ? FRICTION : GRASS_FRICTION),
      deltaTime
    );
    playerVelocity.x *= frameFriction;
    playerVelocity.y *= frameFriction;

    // force stop if very slow
    if (currentSpeed < VELOCITY_THRESHOLD) {
      playerVelocity = { x: 0, y: 0 };
      trailPositions.length = 0; // clear trail
    }

    // handle wall collisions
    if (playerPos.x < BALL_RADIUS) {
      playerPos.x = BALL_RADIUS;
      playerVelocity.x = Math.abs(playerVelocity.x) * BOUNCE;
    }
    if (playerPos.x > 10 - BALL_RADIUS) {
      playerPos.x = 10 - BALL_RADIUS;
      playerVelocity.x = -Math.abs(playerVelocity.x) * BOUNCE;
    }
    if (playerPos.y < BALL_RADIUS) {
      playerPos.y = BALL_RADIUS;
      playerVelocity.y = Math.abs(playerVelocity.y) * BOUNCE;
    }
    if (playerPos.y > 10 - BALL_RADIUS) {
      playerPos.y = 10 - BALL_RADIUS;
      playerVelocity.y = -Math.abs(playerVelocity.y) * BOUNCE;
    }

    // handle obstacle collisions
    obstacles.forEach((obstacle) => {
      const closestX = Math.max(
        obstacle.x,
        Math.min(playerPos.x, obstacle.x + obstacle.width)
      );
      const closestY = Math.max(
        obstacle.y,
        Math.min(playerPos.y, obstacle.y + obstacle.height)
      );
      const distanceX = playerPos.x - closestX;
      const distanceY = playerPos.y - closestY;
      const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

      if (distance < BALL_RADIUS) {
        // Calculate the normal vector
        const normalX = distanceX / distance;
        const normalY = distanceY / distance;

        // Calculate the dot product of the velocity and the normal
        const dotProduct =
          playerVelocity.x * normalX + playerVelocity.y * normalY;

        // Reflect the velocity vector
        playerVelocity.x -= 2 * dotProduct * normalX;
        playerVelocity.y -= 2 * dotProduct * normalY;

        // Apply bounce coefficient
        playerVelocity.x *= BOUNCE;
        playerVelocity.y *= BOUNCE;

        // Adjust the position to avoid sticking to the obstacle
        playerPos.x = closestX + normalX * BALL_RADIUS;
        playerPos.y = closestY + normalY * BALL_RADIUS;
      }
    });

    // target checks
    const dx = playerPos.x - targetPos.x;
    const dy = playerPos.y - targetPos.y;
    const distanceToTarget = Math.sqrt(dx * dx + dy * dy);

    // handle player/target interaction
    if (distanceToTarget < TARGET_THRESHOLD) {
      hasHitTarget = true;
      playerVelocity = { x: 0, y: 0 };
      playerPos = { ...targetPos }; // snap to target
    } else if (distanceToTarget + BALL_RADIUS < TARGET_RADIUS) {
      playerVelocity.x += -dx * 10;
      playerVelocity.y += -dy * 10;
    } else if (distanceToTarget <= TARGET_RADIUS) {
      // add some velocity towards the target
      playerVelocity.x += -dx * TARGET_PULL_FORCE * deltaTime;
      playerVelocity.y += -dy * TARGET_PULL_FORCE * deltaTime;
    }
  }

  function shootBall(dirX, dirY, power) {
    // (dirX, dirY) is a vector pointing from the ball to the drag end, the length should not matter
    const length = Math.sqrt(dirX * dirX + dirY * dirY);
    const normalizedDirX = dirX / length;
    const normalizedDirY = dirY / length;
    const speed = power * MAX_SHOT_SPEED;

    // apply velocity
    playerVelocity = { x: normalizedDirX * speed, y: normalizedDirY * speed };

    // clear trail
    trailPositions.length = 0;

    // consume a shot (alcohol)
    remainingShots--;
    updateRemainingShots();
  }

  /************************/
  /****** Rendering *******/
  /************************/

  function drawPlayer() {
    const canvasPos = gridToCanvas(playerPos.x, playerPos.y);
    context.save();
    context.translate(canvasPos.x, canvasPos.y);
    const radius = (BALL_RADIUS / 10) * canvas.width;

    // Draw the player image with opacity
    context.globalAlpha = playerOpacity;
    context.drawImage(playerImage, -radius, -radius, radius * 2, radius * 2);

    // Add black circle outline
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.strokeStyle = "black";
    context.lineWidth = radius * 0.1;
    context.stroke();

    context.restore();
    context.globalAlpha = 1.0; // Reset opacity for other drawings
  }

  function drawReadyAnimation(deltaTime) {
    const canvasPos = gridToCanvas(playerPos.x, playerPos.y);
    const radius = (0.55 / 10) * canvas.width; // Slightly larger radius for the dashed line
    const circumference = 2 * Math.PI * radius;
    const segmentLength = circumference / 20;

    context.save();
    context.translate(canvasPos.x, canvasPos.y);
    context.rotate(animationAngle);

    context.beginPath();
    // draws a dashed circle with 10 segments equally spaced
    context.setLineDash([segmentLength, segmentLength]);
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.strokeStyle = "black";
    context.lineWidth = radius * 0.1;
    context.stroke();

    context.restore();
    animationAngle += (deltaTime * ANIMATION_ROTATION_SPEED * Math.PI) / 2;
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

  function drawBackground(ctx) {
    const tileSize = ctx.canvas.width / 10;

    ctx.fillStyle = "#90EE90"; // Light green
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    ctx.fillStyle = "#82DD82"; // Darker green
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        if ((i + j) % 2 === 0) {
          ctx.fillRect(i * tileSize, j * tileSize, tileSize, tileSize);
        }
      }
    }
  }

  function drawTarget(ctx) {
    const canvasPos = gridToCanvas(targetPos.x, targetPos.y);
    const radius = (TARGET_RADIUS / 10) * ctx.canvas.width;

    ctx.beginPath();
    ctx.arc(canvasPos.x, canvasPos.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = "black";
    ctx.fill();
  }

  function drawShotIndicator() {
    let dx, dy;
    if (invertAimDirection) {
      dx = dragPos.x - playerPos.x;
      dy = dragPos.y - playerPos.y;
    } else {
      dx = playerPos.x - dragPos.x;
      dy = playerPos.y - dragPos.y;
    }

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
    const canvasPos = gridToCanvas(playerPos.x, playerPos.y);
    const gradient = context.createLinearGradient(
      canvasPos.x,
      canvasPos.y,
      canvasPos.x + dirX * displayLength,
      canvasPos.y + dirY * displayLength
    );
    gradient.addColorStop(0, "rgba(255, 255, 255, 0)"); // gradient start (transparent)
    gradient.addColorStop(1, SHOT_IND_COLOR); // gradient end
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
    context.fillStyle = SHOT_IND_COLOR;
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

  function drawObstacles(ctx) {
    ctx.fillStyle = "grey";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;
    obstacles.forEach((obstacle) => {
      const canvasPos = gridToCanvas(obstacle.x, obstacle.y);
      const width = (obstacle.width / 10) * ctx.canvas.width;
      const height = (obstacle.height / 10) * ctx.canvas.height;
      ctx.fillRect(canvasPos.x, canvasPos.y, width, height);
      ctx.strokeRect(canvasPos.x, canvasPos.y, width, height);
    });
  }

  function drawStaticElements() {
    drawBackground(offscreenContext);
    drawTarget(offscreenContext);
    drawObstacles(offscreenContext);
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
    if (event.button !== 0) {
      // not a left click
      // we won´t catch the mouseup event if e.g. the ctx menu is opened
      if (isDragging) handleDragEnd();
      return;
    }

    if (!isBallStopped) return;
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
    if (!isBallStopped) return;
    event.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const touch = event.touches[0];

    const touchX = (touch.clientX - rect.left) * scaleX;
    const touchY = (touch.clientY - rect.top) * scaleY;
    const gridPos = canvasToGrid(touchX, touchY);

    handleDragStart(gridPos.x, gridPos.y, true);
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
    handleDragEnd(true);
  }

  function handleDragStart(posX, posY, isTouch = false) {
    const distToPlayer = Math.sqrt(
      Math.pow(posX - playerPos.x, 2) + Math.pow(posY - playerPos.y, 2)
    );

    // bigger hitbox for touch
    const detectHitRadius = isTouch ? BALL_RADIUS * 2 : BALL_RADIUS;

    if (distToPlayer <= detectHitRadius) {
      isDragging = true;
      dragPos = { x: posX, y: posY };
    }
  }

  function handleDragMove(posX, posY) {
    if (!isDragging) return;
    dragPos = { x: posX, y: posY };
  }

  function handleDragEnd(isTouch = false) {
    if (!isDragging) return;

    // bigger hitbox for touch
    const detectHitRadius = isTouch ? BALL_RADIUS * 2 : BALL_RADIUS;

    let dx, dy;
    if (invertAimDirection) {
      dx = dragPos.x - playerPos.x;
      dy = dragPos.y - playerPos.y;
    } else {
      dx = playerPos.x - dragPos.x;
      dy = playerPos.y - dragPos.y;
    }

    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < detectHitRadius) {
      isDragging = false;
      return;
    }

    const normalizedDistance = Math.min(distance, MAX_DRAG_DISTANCE);
    const power = normalizedDistance / MAX_DRAG_DISTANCE;

    isDragging = false;
    shootBall(dx, dy, power);
  }

  /************************/
  /**** UI and Coords *****/
  /************************/

  // debounce resize event
  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(resizeCanvas, 200);
  });

  function resizeCanvas() {
    let vw = Math.max(
      document.documentElement.clientWidth || 0,
      window.innerWidth || 0
    );
    let vh = Math.max(
      document.documentElement.clientHeight || 0,
      window.innerHeight || 0
    );

    const availableSize = Math.min(
      vw - 2 * CANVAS_MARGIN,
      vh - 2 * CANVAS_MARGIN
    );

    canvas.width = availableSize;
    canvas.height = availableSize;
    offscreenCanvas.width = availableSize;
    offscreenCanvas.height = availableSize;

    drawStaticElements();
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

  function updateRemainingShots() {
    remainingShotsDiv.innerHTML = "";
    for (let i = 0; i < remainingShots; i++) {
      const img = document.createElement("img");
      img.src = "./assets/golf_cub.png";
      img.style.width = "30px";
      img.style.height = "30px";
      img.style.filter = "invert(1)";
      remainingShotsDiv.appendChild(img);
    }
  }

  function toggleInputDirection() {
    invertAimDirection = !invertAimDirection;
    toggleAimDirBtn.classList.toggle("rotated");
  }

  function updateLevelUI() {
    currentLevelDisplay.textContent = "Level: " + level;
  }
});

window.addEventListener("load", () => {
  /************************/
  /****** Variables *******/
  /************************/

  /** @type {HTMLCanvasElement} */
  const canvas = document.getElementById("playfield");
  /** @type {CanvasRenderingContext2D} */
  const context = canvas.getContext("2d");

  let targetPos = { x: 2, y: 2 };
  let playerPos = { x: 7.5, y: 7.5 };
  let playerVelocity = { x: 0, y: 0 };
  let isDragging = false;
  let dragPos = { x: 0, y: 0 };
  let lastTime = performance.now();
  let hasHitTarget = false;
  let playerOpacity = 1.0;
  let remainingShots = 0;
  let isBallStopped = true;
  let isGameRunning = true;
  let level = 1;
  let obstacles = [];

  const BOUNCE = 0.8; // Bounce coefficient
  const FRICTION = 0.7; // Normal friction
  const BALL_RADIUS = 0.5; // Will be set in resizeCanvas
  const TARGET_RADIUS = 0.75;
  const TARGET_PULL_FORCE = 21; // Force applied towards the target
  const GRASS_FRICTION = 0.95; // Higher friction for slow speeds
  const CRITICAL_SPEED = 2; // Speed threshold where grass friction kicks in
  const MAX_SHOT_SPEED = 42;
  const VELOCITY_THRESHOLD = 0.1; // Threshold for considering ball "stopped"
  const TARGET_THRESHOLD = 0.2; // Threshold for hitting the target
  const TRAIL_LENGTH = 50; // Number of positions to remember
  const trailPositions = []; // Array to store previous positions
  const SHOT_IND_COLOR = "rgba(255, 255, 255, 0.75)";
  const MAX_DRAG_DISTANCE = 4.2; // 5 units based on the 10x10 grid;
  const playerImage = new Image();
  const SHOTS_PER_LEVEL = 4;
  const MAX_NUM_OBSTACLES = 10;

  const gameOverOverlay = document.getElementById("overlay");
  const gameOverlayMessage = document.getElementById("overlay-message");
  const restartButton = document.getElementById("restart-button");
  const continueButton = document.getElementById("next-button");
  const remainingShotsContainer = document.getElementById("remaining-shots");
  restartButton.addEventListener("click", gameOver);
  continueButton.addEventListener("click", nextLevel);

  /************************/
  /**** Initial Setup *****/
  /************************/

  remainingShots = SHOTS_PER_LEVEL;
  playerImage.src = "/assets/golf_ball.png";
  restartGame();
  resizeCanvas();
  requestAnimationFrame(gameLoop);

  /************************/
  /****** Game Loop *******/
  /************************/

  function gameLoop() {
    updateGame();
    requestAnimationFrame(gameLoop);
  }

  function updateGame() {
    if (!isGameRunning) return;

    const currentTime = performance.now();
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    isBallStopped =
      Math.abs(playerVelocity.x) < VELOCITY_THRESHOLD &&
      Math.abs(playerVelocity.y) < VELOCITY_THRESHOLD;

    context.clearRect(0, 0, canvas.width, canvas.height); // clear canvas
    drawBackground();

    drawTarget();
    drawObstacles();

    if (hasHitTarget) {
      if (playerOpacity > 0.01) {
        playerOpacity -= 4.2 * deltaTime;
      } else {
        isGameRunning = false;
        gameOverOverlay.classList.remove("hidden");
        gameOverlayMessage.textContent = "Level " + level + " Complete!";
        restartButton.classList.add("hidden");
        continueButton.classList.remove("hidden");
      }
    } else {
      playerOpacity = 1.0;

      if (!isBallStopped) {
        drawTrail();
        handlePhysics(deltaTime);
      } else {
        if (remainingShots === 0) {
          isGameRunning = false;
          gameOverOverlay.classList.remove("hidden");
          gameOverlayMessage.textContent = "Game Over!";
          restartButton.classList.remove("hidden");
          continueButton.classList.add("hidden");
        }
      }

      if (isDragging) {
        drawShotIndicator();
      }
    }

    if (playerOpacity > 0) {
      drawPlayer();
    }

    updateRemainingShots();
  }

  function generateLevel() {
    // Randomize target position considering target radius
    const minPos = TARGET_RADIUS;
    const maxPos = 10 - TARGET_RADIUS;
    targetPos = {
      x: minPos + Math.random() * (maxPos - minPos),
      y: minPos + Math.random() * (maxPos - minPos),
    };

    // Randomize obstacles
    obstacles = [];
    const maxObstacles = Math.min(Math.floor(level / 2), MAX_NUM_OBSTACLES);
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

        isValidPosition =
          obstacle.x + obstacle.width < targetSquare.x ||
          obstacle.x > targetSquare.x + targetSquare.width ||
          obstacle.y + obstacle.height < targetSquare.y ||
          obstacle.y > targetSquare.y + targetSquare.height;

        if (isValidPosition) {
          obstacles.push(obstacle);
          break;
        }
      }
    }

    // Randomize player position
    let isValidPosition = false;

    while (!isValidPosition) {
      playerPos = {
        x: Math.random() * 10,
        y: Math.random() * 10,
      };

      const distanceToTarget = Math.sqrt(
        Math.pow(playerPos.x - targetPos.x, 2) +
          Math.pow(playerPos.y - targetPos.y, 2)
      );

    const intersectsObstacle = obstacles.some((obstacle) => {
      return (
        playerPos.x + BALL_RADIUS > obstacle.x &&
        playerPos.x - BALL_RADIUS < obstacle.x + obstacle.width &&
        playerPos.y + BALL_RADIUS > obstacle.y &&
        playerPos.y - BALL_RADIUS < obstacle.y + obstacle.height
      );
      });

      const intersectsWall =
        playerPos.x < BALL_RADIUS ||
        playerPos.x > 10 - BALL_RADIUS ||
        playerPos.y < BALL_RADIUS ||
        playerPos.y > 10 - BALL_RADIUS;

      isValidPosition =
        distanceToTarget >= MAX_DRAG_DISTANCE &&
        !intersectsObstacle &&
        !intersectsWall;
    }
  }

  function restartGame() {
    generateLevel();
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
    requestAnimationFrame(gameLoop);
  }

  function nextLevel() {
    level++;
    restartGame();
  }

  function gameOver() {
    level = 1;
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
    trailPositions.unshift(playerPos);
    if (trailPositions.length > TRAIL_LENGTH) {
      trailPositions.pop();
    }

    // update position based on velocity
    playerPos.x += playerVelocity.x * deltaTime;
    playerPos.y += playerVelocity.y * deltaTime;

    // apply friction i.e. update velocity
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

    // Stop the player if the position is really close to the target
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

  function drawTarget() {
    const canvasPos = gridToCanvas(targetPos.x, targetPos.y);
    const radius = (TARGET_RADIUS / 10) * canvas.width;

    context.beginPath();
    context.arc(canvasPos.x, canvasPos.y, radius, 0, Math.PI * 2);
    context.fillStyle = "black";
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

  function drawShotIndicator() {
    const dx = playerPos.x - dragPos.x;
    const dy = playerPos.y - dragPos.y;
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

  function drawObstacles() {
    context.fillStyle = "brown";
    obstacles.forEach((obstacle) => {
      const canvasPos = gridToCanvas(obstacle.x, obstacle.y);
      const width = (obstacle.width / 10) * canvas.width;
      const height = (obstacle.height / 10) * canvas.height;
      context.fillRect(canvasPos.x, canvasPos.y, width, height);
    });
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
      Math.pow(posX - playerPos.x, 2) + Math.pow(posY - playerPos.y, 2)
    );

    if (distToPlayer <= BALL_RADIUS) {
      isDragging = true;
      dragPos = { x: posX, y: posY };
    }
  }

  function handleDragMove(posX, posY) {
    if (!isDragging) return;
    dragPos = { x: posX, y: posY };
  }

  function handleDragEnd() {
    if (!isDragging) return;

    const dx = playerPos.x - dragPos.x;
    const dy = playerPos.y - dragPos.y;
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
    const margin = 100; // 50px padding on each side
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

  function updateRemainingShots() {
    remainingShotsContainer.innerHTML = "";
    for (let i = 0; i < remainingShots; i++) {
      const img = document.createElement("img");
      img.src = "/assets/golf_cub.png";
      img.style.width = "30px";
      img.style.height = "30px";
      img.style.filter = "invert(1)";
      remainingShotsContainer.appendChild(img);
    }
  }
});


// Pet System Logic - Clean Version
console.log("PetSystem script loaded");

window.PetSystem = {
    el: null,
    img: null,
    x: 100,
    y: 100,
    vx: 2,
    vy: 0,
    width: 48,
    height: 48,
    state: 'walking', // walking, dragging, falling, idle
    direction: 1, // 1 = right, -1 = left
    gravity: 0.5,
    bounce: 0.4,
    friction: 0.98,
    jumpPower: 12,
    dragStartX: 0,
    dragStartY: 0,
    lastMouseX: 0,
    lastMouseY: 0,
    floorY: 0,
    platforms: [],
    currentPetFacing: 'right',
    lastScaleX: 1,

    assets: {
        duck: { src: 'pixel_duck.png', facing: 'right' },
        matan: { src: 'pixel_matan.png', facing: 'right' }, // Matan (New Duck)
        dragon: { src: 'pixel_dragon.png', facing: 'left' }, // Dragon faces left in new image
        cat: { src: 'pixel_cat.png', facing: 'left' }, // Cat faces left
        snake: { src: 'pixel_snake.png', facing: 'left' }, // Snake faces left
        wolf: { src: 'pixel_wolf.png', facing: 'left' }, // Wolf faces left
        cow: { src: 'pixel_cow.png', facing: 'left' } // Cow faces left
    },

    init: function () {
        console.log("PetSystem initializing...");
        this.el = document.getElementById('pet-container');
        if (!this.el) {
            console.error("Pet container not found!");
            return;
        }
        this.img = this.el.querySelector('img');

        // Initial Position
        this.floorY = window.innerHeight - 30;
        this.y = this.floorY - this.height;
        this.x = 100;

        // Events
        this.el.addEventListener('mousedown', this.onMouseDown.bind(this));
        window.addEventListener('mousemove', this.onMouseMove.bind(this));
        window.addEventListener('mouseup', this.onMouseUp.bind(this));

        // Touch Events (Mobile)
        this.el.addEventListener('touchstart', (e) => {
            if (e.cancelable) e.preventDefault();
            this.onMouseDown(e.touches[0]);
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            if (this.state === 'dragging' && e.cancelable) e.preventDefault();
            this.onMouseMove(e.touches[0]);
        }, { passive: false });

        window.addEventListener('touchend', this.onMouseUp.bind(this));

        // Start Loop
        requestAnimationFrame(this.update.bind(this));
    },

    setPet: function (name) {
        if (this.assets[name]) {
            this.img.src = this.assets[name].src + '?v=' + Date.now() + '_matan';
            this.currentPetFacing = this.assets[name].facing;
        }
    },

    setSize: function (size) {
        this.width = size;
        this.height = size;
        this.img.style.width = size + 'px';
        this.img.style.height = size + 'px';
    },

    setJumpPower: function (power) {
        this.jumpPower = power;
    },

    onMouseDown: function (e) {
        e.preventDefault();
        this.state = 'dragging';
        this.el.classList.add('dragging');
        this.el.classList.remove('pet-walking');
        this.dragStartX = e.clientX - this.x;
        this.dragStartY = e.clientY - this.y;
        this.vx = 0;
        this.vy = 0;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
    },

    onMouseMove: function (e) {
        if (this.state === 'dragging') {
            this.x = e.clientX - this.dragStartX;
            this.y = e.clientY - this.dragStartY;
            this.vx = (e.clientX - this.lastMouseX) * 0.5;
            this.vy = (e.clientY - this.lastMouseY) * 0.5;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
        }
    },

    onMouseUp: function () {
        if (this.state === 'dragging') {
            this.state = 'falling';
            this.el.classList.remove('dragging');
            // Cap velocity
            if (this.vx > 20) this.vx = 20;
            if (this.vx < -20) this.vx = -20;
            if (this.vy > 20) this.vy = 20;
            if (this.vy < -20) this.vy = -20;
        }
    },

    findPlatforms: function () {
        // Collect potential platforms (Optimization: only visible ones)
        const candidates = [
            ...document.querySelectorAll('.window'),
            ...document.querySelectorAll('.taskbar'),
            ...document.querySelectorAll('.time-slot'),
            ...document.querySelectorAll('.task-card'),
            ...document.querySelectorAll('.sidebar')
        ];

        this.platforms = [];

        candidates.forEach(el => {
            const rect = el.getBoundingClientRect();
            // Ignore hidden or tiny elements
            if (rect.height < 5 || rect.width < 10) return;

            this.platforms.push({
                top: rect.top,
                bottom: rect.bottom,
                left: rect.left,
                right: rect.right,
                id: el.id || el.className
            });
        });
    },

    update: function () {
        this.floorY = window.innerHeight - 30;

        if (this.state !== 'dragging') {
            // Apply Physics
            this.vy += this.gravity;
            this.x += this.vx;
            this.y += this.vy;
            this.vx *= 0.99; // Air drag

            // Floor Collision
            let onGround = false;

            if (this.y + this.height >= this.floorY) {
                this.y = this.floorY - this.height;
                this.vy *= -this.bounce * 0.5;
                this.vx *= this.friction;
                if (Math.abs(this.vy) < 1) this.vy = 0;
                onGround = true;
            }

            // Custom Platforms (Only apply if falling down and not already on floor)
            if (this.vy >= 0 && !onGround) {
                // Throttle platform search (approx every 20 frames for performance)
                if (Math.random() < 0.05) this.findPlatforms();

                const footX = this.x + this.width / 2;
                const footY = this.y + this.height;

                for (let p of this.platforms) {
                    // Check if feet are close to top of platform
                    if (footX >= p.left && footX <= p.right &&
                        footY >= p.top - 10 && footY <= p.top + 15) {

                        this.y = p.top - this.height;
                        this.vy = 0;
                        this.vx *= this.friction;
                        onGround = true;
                        break;
                    }
                }
            }

            // Wall Collision
            if (this.x < 0) {
                this.x = 0;
                this.vx *= -1;
            }
            if (this.x + this.width > window.innerWidth) {
                this.x = window.innerWidth - this.width;
                this.vx *= -1;
            }

            // Behavior Logic (Random movement)
            if (onGround) { // On Ground (Floor or Platform)
                // Random Jump
                if (Math.random() < 0.005) {
                    this.vy = -this.jumpPower - Math.random() * 4;
                }

                // Random Walk
                if (Math.abs(this.vx) < 0.5) {
                    // Start Walking
                    if (Math.random() < 0.02) {
                        this.direction = Math.random() > 0.5 ? 1 : -1;
                        this.vx = this.direction * 2;
                    }
                }
            }

            // Visuals
            const isMoving = Math.abs(this.vx) > 0.5;
            if (isMoving) {
                this.el.classList.add('pet-walking');
                const dir = this.vx > 0 ? 1 : -1;
                // Facing Logic: 
                // if asset is right(1) and moving right(1) -> 1
                // if asset is right(1) and moving left(-1) -> -1
                // if asset is left(-1) and moving right(1) -> -1
                // if asset is left(-1) and moving left(-1) -> 1

                let scale = dir;
                if (this.currentPetFacing === 'left') scale *= -1;

                this.lastScaleX = scale;

                // Bobbing
                const rot = Math.sin(this.x * 0.2) * 5;
                this.img.style.transform = `scaleX(${scale}) rotate(${rot}deg)`;
            } else {
                this.el.classList.remove('pet-walking');
                this.img.style.transform = `scaleX(${this.lastScaleX})`;
            }
        }

        // Render
        this.el.style.left = this.x + 'px';
        this.el.style.top = this.y + 'px';

        requestAnimationFrame(this.update.bind(this));
    }
};

// Global accessor
window.selectPet = function (name) {
    if (window.PetSystem) PetSystem.setPet(name);
};

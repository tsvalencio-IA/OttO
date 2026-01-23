/* =================================================================
   PHYSICS & GAMEPLAY CONSTANTS (TUNING)
   ================================================================= */
window.K = {
    // ENGINE SPECS
    MAX_SPEED: 240,         // Top speed (km/h visual)
    ACCEL: 45,              // Acceleration rate
    BREAKING: -80,          // Brake force
    DECEL: -5,              // Natural rolling resistance
    OFFROAD_DECEL: -120,    // Grass friction (Heavy drag)
    OFFROAD_LIMIT: 60,      // Max speed on grass
    
    // STEERING PHYSICS
    CENTRIFUGAL: 0.35,      // How much curves push you out
    STEER_SPEED: 2.2,       // Turning sensitivity
    GRIP_LATERAL: 1.5,      // Tire grip
    DRIFT_BONUS: 0.8,       // Extra turning during drift
    
    // WORLD
    SEGMENT_LENGTH: 200,    // Z-depth of one road slice
    RUMBLE_LENGTH: 3,       // Visual rumble strip length
    LANES: 3,               // Number of lanes
    ROAD_WIDTH: 2000,       // Real world width units
    CAMERA_HEIGHT: 1000,    // Camera Y
    CAMERA_DEPTH: 0.8,      // Camera distance (FOV)
    
    // GAMEPLAY
    TOTAL_LAPS: 3,
    GRAVITY: -10,
    COLLISION_BOUNCE: -0.5  // Elasticity
};
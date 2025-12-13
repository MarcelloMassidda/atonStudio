/**
 * Scene Migration Utilities
 * 
 * Handles automatic migration of scene data structures
 * Currently supports: capabilities → behaviours migration
 */

export class SceneMigration {
  /**
   * Migrate capabilities to behaviours in scene JSON
   * Auto-detects if migration is needed and performs it
   * 
   * @param {Object} scene - Scene JSON object
   * @returns {Object} - Migrated scene JSON
   */
  static migrateCapabilitiesToBehaviours(scene) {
    // If scene already has behaviours, no migration needed
    if (scene.behaviours && !scene.capabilities) {
      console.log("✨ Scene already using behaviours system");
      return scene;
    }

    // If scene has no capabilities, nothing to migrate
    if (!scene.capabilities) {
      console.log("✨ No capabilities to migrate");
      // Ensure behaviours object exists
      if (!scene.behaviours) scene.behaviours = {};
      return scene;
    }

    console.log("🔄 Migrating capabilities → behaviours...");

    // Initialize behaviours if not present
    if (!scene.behaviours) scene.behaviours = {};

    // Copy all capabilities to behaviours
    for (const [capabilityId, capabilityData] of Object.entries(scene.capabilities)) {
      if (!scene.behaviours[capabilityId]) {
        scene.behaviours[capabilityId] = capabilityData;
        console.log(`  ✅ Migrated capability: ${capabilityId}`);
      } else {
        console.log(`  ⚠️ Behaviour ${capabilityId} already exists, skipping migration`);
      }
    }

    // Keep capabilities for backward compatibility during transition
    // Don't delete scene.capabilities yet - allow both to coexist
    console.log("✨ Migration complete - both capabilities and behaviours available");

    return scene;
  }

  /**
   * Apply all migrations to a scene
   * This is the main entry point for scene migration
   * 
   * @param {Object} scene - Scene JSON object
   * @returns {Object} - Migrated scene JSON
   */
  static migrateScene(scene) {
    if (!scene) return scene;

    // Apply capability → behaviour migration
    scene = SceneMigration.migrateCapabilitiesToBehaviours(scene);

    // Future migrations can be added here
    // scene = SceneMigration.migrateSomeOtherFeature(scene);

    return scene;
  }

  /**
   * Check if a scene needs migration
   * 
   * @param {Object} scene - Scene JSON object
   * @returns {boolean} - True if migration is needed
   */
  static needsMigration(scene) {
    if (!scene) return false;

    // Check if has capabilities but no behaviours
    if (scene.capabilities && !scene.behaviours) {
      return true;
    }

    return false;
  }
}

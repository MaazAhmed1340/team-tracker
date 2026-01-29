import { pool } from "../server/db";

async function fixUserRoles() {
  try {
    console.log("Fixing user roles...");
    
    // Use raw SQL to update roles before enum is created
    // First, check what roles exist
    const checkResult = await pool.query(`
      SELECT id, email, role 
      FROM users 
      WHERE role NOT IN ('admin', 'manager', 'viewer')
    `);
    
    console.log(`Found ${checkResult.rows.length} users with invalid roles`);
    
    if (checkResult.rows.length > 0) {
      console.log("Users to update:");
      checkResult.rows.forEach((user: any) => {
        console.log(`  - ${user.email}: '${user.role}' -> 'viewer'`);
      });
    }
    
    // Update any users with invalid roles to "viewer"
    const updateResult = await pool.query(`
      UPDATE users 
      SET role = 'viewer' 
      WHERE role NOT IN ('admin', 'manager', 'viewer')
    `);
    
    console.log(`✅ Updated ${updateResult.rowCount} user(s) to 'viewer' role`);
    console.log("\n✅ User roles fixed! You can now run 'npm run db:push'");
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("Error fixing user roles:", error);
    await pool.end();
    process.exit(1);
  }
}

fixUserRoles();

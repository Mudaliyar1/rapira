  const express = require('express');
const router = express.Router();
const Role = require('../models/Role');
const UserRole = require('../models/UserRole');
const User = require('../models/User');
const { isLoggedIn, isAdmin } = require('../middleware/auth');

// Admin: List all roles
router.get('/', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get search parameters
    const { search, sortBy, sortOrder } = req.query;

    // Build sort options
    let sortOptions = { name: 1 }; // Default sort
    if (sortBy) {
      const order = sortOrder === 'desc' ? -1 : 1;
      sortOptions = { [sortBy]: order };
    }

    // Get all roles
    let roles = await Role.find()
      .sort(sortOptions)
      .populate('createdBy', 'name');

    // Apply text search
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      roles = roles.filter(role => {
        const name = (role.name || '').toLowerCase();
        const description = (role.description || '').toLowerCase();
        const createdBy = (role.createdBy ? role.createdBy.name : '').toLowerCase();

        return name.includes(searchTerm) ||
               description.includes(searchTerm) ||
               createdBy.includes(searchTerm);
      });
    }

    // Get statistics
    const totalRoles = await Role.countDocuments();

    // Get role usage statistics
    const roleUsage = {};
    for (const role of roles) {
      const userCount = await UserRole.countDocuments({ role: role._id });
      roleUsage[role._id] = userCount;
    }

    res.render('admin/roles', {
      layout: 'admin',
      title: 'Manage Roles',
      currentPath: '/roles',
      roles,
      roleUsage,
      searchParams: {
        search: search || '',
        sortBy: sortBy || 'name',
        sortOrder: sortOrder || 'asc'
      },
      stats: {
        total: totalRoles,
        filtered: roles.length
      }
    });
  } catch (error) {
    console.error('Error in roles list:', error);
    req.flash('error', 'An error occurred while loading roles');
    res.redirect('/admin');
  }
});

// Export roles to CSV
router.get('/export', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get search parameters (same as main roles route)
    const { search, sortBy, sortOrder } = req.query;

    // Build sort options
    let sortOptions = { name: 1 };
    if (sortBy) {
      const order = sortOrder === 'desc' ? -1 : 1;
      sortOptions = { [sortBy]: order };
    }

    // Get all roles
    let roles = await Role.find()
      .sort(sortOptions)
      .populate('createdBy', 'name');

    // Apply text search
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      roles = roles.filter(role => {
        const name = (role.name || '').toLowerCase();
        const description = (role.description || '').toLowerCase();
        const createdBy = (role.createdBy ? role.createdBy.name : '').toLowerCase();

        return name.includes(searchTerm) ||
               description.includes(searchTerm) ||
               createdBy.includes(searchTerm);
      });
    }

    // Get role usage statistics
    const roleUsage = {};
    for (const role of roles) {
      const userCount = await UserRole.countDocuments({ role: role._id });
      roleUsage[role._id] = userCount;
    }

    // Generate CSV content
    const csvHeader = 'Role Name,Description,Icon,Created By,Created Date,Users Assigned\n';
    const csvRows = roles.map(role => {
      const name = `"${(role.name || '').replace(/"/g, '""')}"`;
      const description = `"${(role.description || '').replace(/"/g, '""')}"`;
      const icon = role.icon || '';
      const createdBy = `"${(role.createdBy ? role.createdBy.name : '').replace(/"/g, '""')}"`;
      const createdDate = new Date(role.createdAt).toLocaleDateString();
      const usersAssigned = roleUsage[role._id] || 0;

      return `${name},${description},${icon},${createdBy},${createdDate},${usersAssigned}`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // Set response headers for file download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `roles_export_${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Export roles error:', error);
    req.flash('error', 'Failed to export roles');
    res.redirect('/roles');
  }
});

// Admin: Add role form
router.get('/add', isLoggedIn, isAdmin, (req, res) => {
  res.render('admin/add-role', {
    layout: 'admin',
    title: 'Add Role',
    currentPath: '/roles'
  });
});

// Admin: Add role process
router.post('/add', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { name, description, icon } = req.body;

    // Validate input
    if (!name) {
      req.flash('error', 'Role name is required');
      return res.redirect('/roles/add');
    }

    // Check if role already exists
    const existingRole = await Role.findOne({ name });

    if (existingRole) {
      req.flash('error', 'A role with this name already exists');
      return res.redirect('/roles/add');
    }

    // Create new role
    const newRole = new Role({
      name,
      description: description || '',
      icon: icon || 'bi-person',
      createdBy: req.session.user.id
    });

    await newRole.save();

    req.flash('success', 'Role added successfully');
    res.redirect('/roles');
  } catch (error) {
    console.error('Error in add role:', error);
    req.flash('error', 'An error occurred while adding the role');
    res.redirect('/roles/add');
  }
});

// Admin: Edit role form
router.get('/edit/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);

    if (!role) {
      req.flash('error', 'Role not found');
      return res.redirect('/roles');
    }

    res.render('admin/edit-role', {
      layout: 'admin',
      title: 'Edit Role',
      currentPath: '/roles',
      role
    });
  } catch (error) {
    console.error('Error in edit role form:', error);
    req.flash('error', 'An error occurred while loading the role');
    res.redirect('/roles');
  }
});

// Admin: Edit role process
router.post('/edit/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { name, description, icon } = req.body;

    // Validate input
    if (!name) {
      req.flash('error', 'Role name is required');
      return res.redirect(`/roles/edit/${req.params.id}`);
    }

    const role = await Role.findById(req.params.id);

    if (!role) {
      req.flash('error', 'Role not found');
      return res.redirect('/roles');
    }

    // Check if name is changed and already exists
    if (name !== role.name) {
      const existingRole = await Role.findOne({ name });

      if (existingRole) {
        req.flash('error', 'A role with this name already exists');
        return res.redirect(`/roles/edit/${req.params.id}`);
      }
    }

    // Update role
    role.name = name;
    role.description = description || '';
    role.icon = icon || 'bi-person';

    await role.save();

    req.flash('success', 'Role updated successfully');
    res.redirect('/roles');
  } catch (error) {
    console.error('Error in edit role:', error);
    req.flash('error', 'An error occurred while updating the role');
    res.redirect('/roles');
  }
});

// Admin: Confirm delete role
router.get('/confirm-delete/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);

    if (!role) {
      req.flash('error', 'Role not found');
      return res.redirect('/roles');
    }

    // Check if role is assigned to any users
    const userRoles = await UserRole.find({ role: role._id });

    // Clean up any orphaned user role assignments
    for (const userRole of userRoles) {
      const userExists = await User.findById(userRole.user);
      if (!userExists) {
        await UserRole.findByIdAndDelete(userRole._id);
        console.log(`Removed orphaned user role assignment: ${userRole._id}`);
      }
    }

    // Recount valid assignments after cleanup
    const validUserRoles = await UserRole.find({ role: role._id }).populate('user');
    const isAssigned = validUserRoles.length > 0;

    res.render('admin/confirm-delete-role', {
      layout: 'admin',
      title: 'Confirm Delete Role',
      currentPath: '/roles',
      role,
      isAssigned
    });
  } catch (error) {
    console.error('Error in confirm delete role:', error);
    req.flash('error', 'An error occurred while loading the confirmation page');
    res.redirect('/roles');
  }
});

// Admin: Delete role
router.post('/delete/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);

    if (!role) {
      req.flash('error', 'Role not found');
      return res.redirect('/roles');
    }

    // Check if role is assigned to any users
    const userRoles = await UserRole.find({ role: role._id });

    // If there are user role assignments, remove them all
    if (userRoles.length > 0) {
      console.log(`Removing ${userRoles.length} user role assignments for role ${role.name}`);
      await UserRole.deleteMany({ role: role._id });
      req.flash('info', `Role was assigned to ${userRoles.length} users. All assignments have been removed.`);
    }

    // Delete role
    await Role.findByIdAndDelete(req.params.id);

    req.flash('success', 'Role deleted successfully');
    res.redirect('/roles');
  } catch (error) {
    console.error('Error in delete role:', error);
    req.flash('error', 'An error occurred while deleting the role');
    res.redirect('/roles');
  }
});

// Admin: Manage user roles
router.get('/user-roles', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get search parameters
    const { search, userRole, assignedRole, hasRoles, sortBy, sortOrder } = req.query;

    // Build user query
    let userQuery = { role: { $in: ['user', 'artist'] } };

    // User role filter
    if (userRole && userRole !== 'all') {
      userQuery.role = userRole;
    }

    // Build sort options
    let sortOptions = { name: 1 }; // Default sort
    if (sortBy) {
      const order = sortOrder === 'desc' ? -1 : 1;
      sortOptions = { [sortBy]: order };
    }

    // Get all users with filters
    let users = await User.find(userQuery).sort(sortOptions);

    // Apply text search on user data
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      users = users.filter(user => {
        const name = (user.name || '').toLowerCase();
        const email = (user.email || '').toLowerCase();

        return name.includes(searchTerm) || email.includes(searchTerm);
      });
    }

    // Get all roles
    const roles = await Role.find().sort({ name: 1 });

    // Get user roles
    const userRoles = await UserRole.find()
      .populate('user', 'name email')
      .populate('role', 'name');

    // Create a map of user roles for easier access
    const userRoleMap = {};

    userRoles.forEach(ur => {
      // Skip if user or role is null
      if (!ur.user || !ur.role) {
        console.warn('Found user role with missing user or role reference:', ur);
        return; // Skip this iteration
      }

      if (!userRoleMap[ur.user._id]) {
        userRoleMap[ur.user._id] = [];
      }

      userRoleMap[ur.user._id].push(ur.role._id.toString());
    });

    // Filter by assigned role
    if (assignedRole && assignedRole !== 'all') {
      users = users.filter(user => {
        const userRoleIds = userRoleMap[user._id] || [];
        return userRoleIds.includes(assignedRole);
      });
    }

    // Filter by has roles
    if (hasRoles && hasRoles !== 'all') {
      users = users.filter(user => {
        const userRoleIds = userRoleMap[user._id] || [];
        if (hasRoles === 'with-roles') {
          return userRoleIds.length > 0;
        } else if (hasRoles === 'without-roles') {
          return userRoleIds.length === 0;
        }
        return true;
      });
    }

    // Clean up orphaned user roles (those with missing user or role references)
    try {
      const orphanedRoles = await UserRole.find({ $or: [{ user: null }, { role: null }] });
      if (orphanedRoles.length > 0) {
        console.log(`Found ${orphanedRoles.length} orphaned user roles. Cleaning up...`);
        await UserRole.deleteMany({ $or: [{ user: null }, { role: null }] });
      }
    } catch (cleanupError) {
      console.error('Error cleaning up orphaned user roles:', cleanupError);
      // Continue with the request even if cleanup fails
    }

    // Get statistics
    const totalUsers = await User.countDocuments({ role: { $in: ['user', 'artist'] } });
    const artistUsers = await User.countDocuments({ role: 'artist' });
    const regularUsers = await User.countDocuments({ role: 'user' });
    const usersWithRoles = Object.keys(userRoleMap).length;
    const usersWithoutRoles = totalUsers - usersWithRoles;

    res.render('admin/user-roles', {
      layout: 'admin',
      title: 'Manage User Roles',
      currentPath: '/roles/user-roles',
      users,
      roles,
      userRoleMap,
      searchParams: {
        search: search || '',
        userRole: userRole || 'all',
        assignedRole: assignedRole || 'all',
        hasRoles: hasRoles || 'all',
        sortBy: sortBy || 'name',
        sortOrder: sortOrder || 'asc'
      },
      stats: {
        total: totalUsers,
        artists: artistUsers,
        regular: regularUsers,
        withRoles: usersWithRoles,
        withoutRoles: usersWithoutRoles,
        filtered: users.length
      }
    });
  } catch (error) {
    console.error('Error in user roles list:', error);
    req.flash('error', 'An error occurred while loading user roles');
    res.redirect('/admin');
  }
});

// Export user roles to CSV
router.get('/user-roles/export', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get search parameters (same as main user-roles route)
    const { search, userRole, assignedRole, hasRoles, sortBy, sortOrder } = req.query;

    // Build user query
    let userQuery = { role: { $in: ['user', 'artist'] } };

    // User role filter
    if (userRole && userRole !== 'all') {
      userQuery.role = userRole;
    }

    // Build sort options
    let sortOptions = { name: 1 }; // Default sort
    if (sortBy) {
      const order = sortOrder === 'desc' ? -1 : 1;
      sortOptions = { [sortBy]: order };
    }

    // Get all users with filters
    let users = await User.find(userQuery).sort(sortOptions);

    // Apply text search on user data
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      users = users.filter(user => {
        const name = (user.name || '').toLowerCase();
        const email = (user.email || '').toLowerCase();

        return name.includes(searchTerm) || email.includes(searchTerm);
      });
    }

    // Get all roles
    const roles = await Role.find().sort({ name: 1 });

    // Get user roles
    const userRoles = await UserRole.find()
      .populate('user', 'name email')
      .populate('role', 'name');

    // Create a map of user roles for easier access
    const userRoleMap = {};
    userRoles.forEach(ur => {
      if (!ur.user || !ur.role) return;

      if (!userRoleMap[ur.user._id]) {
        userRoleMap[ur.user._id] = [];
      }
      userRoleMap[ur.user._id].push(ur.role.name);
    });

    // Apply additional filters
    if (assignedRole && assignedRole !== 'all') {
      const roleObj = roles.find(r => r._id.toString() === assignedRole);
      const roleName = roleObj ? roleObj.name : '';
      users = users.filter(user => {
        const userRoleNames = userRoleMap[user._id] || [];
        return userRoleNames.includes(roleName);
      });
    }

    if (hasRoles && hasRoles !== 'all') {
      users = users.filter(user => {
        const userRoleNames = userRoleMap[user._id] || [];
        if (hasRoles === 'with-roles') {
          return userRoleNames.length > 0;
        } else if (hasRoles === 'without-roles') {
          return userRoleNames.length === 0;
        }
        return true;
      });
    }

    // Generate CSV content
    const csvHeader = 'Name,Email,User Role,Assigned Roles,Role Count,Join Date\n';
    const csvRows = users.map(user => {
      const name = `"${(user.name || '').replace(/"/g, '""')}"`;
      const email = `"${(user.email || '').replace(/"/g, '""')}"`;
      const userRole = user.role;
      const assignedRoles = `"${(userRoleMap[user._id] || []).join(', ').replace(/"/g, '""')}"`;
      const roleCount = (userRoleMap[user._id] || []).length;
      const joinDate = new Date(user.createdAt).toLocaleDateString();

      return `${name},${email},${userRole},${assignedRoles},${roleCount},${joinDate}`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // Set response headers for file download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `user_roles_export_${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Export user roles error:', error);
    req.flash('error', 'Failed to export user roles');
    res.redirect('/roles/user-roles');
  }
});

// Admin: Assign role to user form
router.get('/assign-to-user/:userId', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const userId = req.params.userId;

    // Get user
    const user = await User.findById(userId);

    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/roles/user-roles');
    }

    // Get all roles
    const roles = await Role.find().sort({ name: 1 });

    // Get user's current roles
    const userRoles = await UserRole.find({ user: userId }).populate('role');

    // Create a list of role IDs the user already has (filter out null roles)
    const userRoleIds = userRoles
      .filter(ur => ur.role) // Filter out null role references
      .map(ur => ur.role._id.toString());

    // Filter out roles the user already has
    const availableRoles = roles.filter(role => !userRoleIds.includes(role._id.toString()));

    res.render('admin/assign-role', {
      layout: 'admin',
      title: `Assign Role to ${user.name}`,
      currentPath: '/roles/user-roles',
      user,
      availableRoles
    });
  } catch (error) {
    console.error('Error in assign role form:', error);
    req.flash('error', 'An error occurred while loading the assign role form');
    res.redirect('/roles/user-roles');
  }
});

// Admin: Assign role to user process
router.post('/assign', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { userId, roleId } = req.body;

    // Validate input
    if (!userId || !roleId) {
      req.flash('error', 'User and role are required');
      return res.redirect('/roles/user-roles');
    }

    // Check if user and role exist
    const user = await User.findById(userId);
    const role = await Role.findById(roleId);

    if (!user || !role) {
      req.flash('error', 'User or role not found');
      return res.redirect('/roles/user-roles');
    }

    // Check if user already has this role
    const existingUserRole = await UserRole.findOne({ user: userId, role: roleId });

    if (existingUserRole) {
      req.flash('error', 'User already has this role');
      return res.redirect('/roles/user-roles');
    }

    // Assign role to user
    const newUserRole = new UserRole({
      user: userId,
      role: roleId
    });

    await newUserRole.save();

    req.flash('success', 'Role assigned successfully');
    res.redirect('/roles/user-roles');
  } catch (error) {
    console.error('Error in assign role:', error);
    req.flash('error', 'An error occurred while assigning the role');
    res.redirect('/roles/user-roles');
  }
});

// Admin: Remove role from user
router.post('/remove', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { userId, roleId } = req.body;

    // Validate input
    if (!userId || !roleId) {
      req.flash('error', 'User and role are required');
      return res.redirect('/roles/user-roles');
    }

    // Remove role from user
    await UserRole.findOneAndDelete({ user: userId, role: roleId });

    req.flash('success', 'Role removed successfully');
    res.redirect('/roles/user-roles');
  } catch (error) {
    console.error('Error in remove role:', error);
    req.flash('error', 'An error occurred while removing the role');
    res.redirect('/roles/user-roles');
  }
});

// User: View available roles (for filtering)
router.get('/available', isLoggedIn, async (req, res) => {
  try {
    const roles = await Role.find().sort({ name: 1 });

    res.render('roles/available', {
      title: 'Available Roles',
      roles
    });
  } catch (error) {
    console.error('Error in available roles:', error);
    req.flash('error', 'An error occurred while loading roles');
    res.redirect('/');
  }
});

module.exports = router;

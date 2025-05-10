const express = require('express');
const router = express.Router();
const Role = require('../models/Role');
const UserRole = require('../models/UserRole');
const User = require('../models/User');
const { isLoggedIn, isAdmin } = require('../middleware/auth');

// Admin: List all roles
router.get('/', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const roles = await Role.find()
      .sort({ name: 1 })
      .populate('createdBy', 'name');

    res.render('admin/roles', {
      layout: 'admin',
      title: 'Manage Roles',
      currentPath: '/roles',
      roles
    });
  } catch (error) {
    console.error('Error in roles list:', error);
    req.flash('error', 'An error occurred while loading roles');
    res.redirect('/admin');
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
    // Get all users with artist or user role
    const users = await User.find({ role: { $in: ['user', 'artist'] } })
      .sort({ name: 1 });

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

    res.render('admin/user-roles', {
      layout: 'admin',
      title: 'Manage User Roles',
      currentPath: '/roles/user-roles',
      users,
      roles,
      userRoleMap
    });
  } catch (error) {
    console.error('Error in user roles list:', error);
    req.flash('error', 'An error occurred while loading user roles');
    res.redirect('/admin');
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

    // Create a list of role IDs the user already has
    const userRoleIds = userRoles.map(ur => ur.role._id.toString());

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

import api from './api';

/**
 * User Management Service
 * Handles all user-related API calls
 */

// Get all users
export const getUsers = async () => {
  try {
    const response = await api.get('/users');
    return response.data;
  } catch (error) {
    console.error('[UserService] Error fetching users:', error);
    throw error;
  }
};

// Get user by ID
export const getUserById = async (id) => {
  try {
    const response = await api.get(`/users/${id}`);
    return response.data;
  } catch (error) {
    console.error('[UserService] Error fetching user:', error);
    throw error;
  }
};

// Create new user
export const createUser = async (userData) => {
  try {
    const response = await api.post('/users', userData);
    return response.data;
  } catch (error) {
    console.error('[UserService] Error creating user:', error);
    throw error;
  }
};

// Update user
export const updateUser = async (id, userData) => {
  try {
    const response = await api.put(`/users/${id}`, userData);
    return response.data;
  } catch (error) {
    console.error('[UserService] Error updating user:', error);
    throw error;
  }
};

// Update user password
export const updateUserPassword = async (id, newPassword) => {
  try {
    const response = await api.put(`/users/${id}/password`, { newPassword });
    return response.data;
  } catch (error) {
    console.error('[UserService] Error updating password:', error);
    throw error;
  }
};

// Update user roles
export const updateUserRoles = async (id, roleIds) => {
  try {
    const response = await api.put(`/users/${id}/roles`, { roleIds });
    return response.data;
  } catch (error) {
    console.error('[UserService] Error updating roles:', error);
    throw error;
  }
};

// Get all roles
export const getRoles = async () => {
  try {
    const response = await api.get('/users/roles/all');
    return response.data;
  } catch (error) {
    console.error('[UserService] Error fetching roles:', error);
    throw error;
  }
};

// Create new role
export const createRole = async (roleData) => {
  try {
    const response = await api.post('/users/roles', roleData);
    return response.data;
  } catch (error) {
    console.error('[UserService] Error creating role:', error);
    throw error;
  }
};

// Get pages assigned to a role
export const getRolePages = async (roleId) => {
  try {
    const response = await api.get(`/users/roles/${roleId}/pages`);
    return response.data;
  } catch (error) {
    console.error('[UserService] Error fetching role pages:', error);
    throw error;
  }
};

// Update role pages
export const updateRolePages = async (roleId, pageIds) => {
  try {
    const response = await api.put(`/users/roles/${roleId}/pages`, { pageIds });
    return response.data;
  } catch (error) {
    console.error('[UserService] Error updating role pages:', error);
    throw error;
  }
};

// Get all pages
export const getPages = async () => {
  try {
    const response = await api.get('/users/pages/all');
    return response.data;
  } catch (error) {
    console.error('[UserService] Error fetching pages:', error);
    throw error;
  }
};

// Delete role
export const deleteRole = async (roleId) => {
  try {
    const response = await api.delete(`/users/roles/${roleId}`);
    return response.data;
  } catch (error) {
    console.error('[UserService] Error deleting role:', error);
    throw error;
  }
};

// Delete user
export const deleteUser = async (userId) => {
  try {
    const response = await api.delete(`/users/${userId}`);
    return response.data;
  } catch (error) {
    console.error('[UserService] Error deleting user:', error);
    throw error;
  }
};

export default {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserPassword,
  updateUserRoles,
  getRoles,
  createRole,
  getRolePages,
  updateRolePages,
  getPages,
  deleteRole,
  deleteUser,
};


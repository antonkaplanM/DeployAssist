import React, { useState, useEffect } from 'react';
import {
  UserIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  KeyIcon,
  ShieldCheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import {
  getUsers,
  createUser,
  updateUser,
  updateUserRoles,
  updateUserPassword,
  deleteUser,
  getRoles,
  createRole,
  getRolePages,
  updateRolePages,
  getPages,
  deleteRole,
} from '../services/userService';

const UserManagement = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [passwordUserId, setPasswordUserId] = useState(null);
  const [passwordUsername, setPasswordUsername] = useState('');
  const [userFormData, setUserFormData] = useState({
    username: '',
    full_name: '',
    password: '',
    roleIds: [],
    is_active: true,
  });
  const [roleFormData, setRoleFormData] = useState({
    name: '',
    description: '',
    pageIds: [],
  });
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersData, rolesData, pagesData] = await Promise.all([
        getUsers(),
        getRoles(),
        getPages(),
      ]);

      if (usersData.success) {
        setUsers(usersData.users);
      }

      if (rolesData.success) {
        setRoles(rolesData.roles);
      }

      if (pagesData.success) {
        setPages(pagesData.pages);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      showError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const showError = (message) => {
    setError(message);
    setTimeout(() => setError(null), 5000);
  };

  const showSuccess = (message) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 5000);
  };

  // User Management Functions
  const handleUserSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (userFormData.roleIds.length === 0) {
        showError('Please select at least one role');
        setSubmitting(false);
        return;
      }

      if (editingUser) {
        await updateUser(editingUser.id, {
          full_name: userFormData.full_name,
          is_active: userFormData.is_active,
        });
        await updateUserRoles(editingUser.id, userFormData.roleIds);
        showSuccess('User updated successfully');
      } else {
        await createUser({
          username: userFormData.username,
          password: userFormData.password,
          full_name: userFormData.full_name,
          roleIds: userFormData.roleIds,
        });
        showSuccess('User created successfully');
      }

      setShowUserModal(false);
      setEditingUser(null);
      resetUserForm();
      fetchData();
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to save user');
    } finally {
      setSubmitting(false);
    }
  };

  const resetUserForm = () => {
    setUserFormData({
      username: '',
      full_name: '',
      password: '',
      roleIds: [],
      is_active: true,
    });
  };

  const handleEditUser = async (user) => {
    setEditingUser(user);
    setUserFormData({
      username: user.username,
      full_name: user.full_name,
      password: '',
      roleIds: user.roles?.map((r) => r.id) || [],
      is_active: user.is_active,
    });
    setShowUserModal(true);
  };

  const handleDeleteUser = async (userId, username) => {
    if (userId === currentUser?.id) {
      showError('You cannot delete your own account');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete user "${username}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      await deleteUser(userId);
      showSuccess('User deleted successfully');
      fetchData();
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleChangePassword = (userId, username) => {
    setPasswordUserId(userId);
    setPasswordUsername(username);
    setNewPassword('');
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    if (newPassword.length < 8) {
      showError('Password must be at least 8 characters');
      setSubmitting(false);
      return;
    }

    try {
      await updateUserPassword(passwordUserId, newPassword);
      showSuccess('Password changed successfully');
      setShowPasswordModal(false);
      setPasswordUserId(null);
      setNewPassword('');
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setSubmitting(false);
    }
  };

  // Role Management Functions
  const handleRoleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (roleFormData.pageIds.length === 0) {
        showError('Please select at least one page for this role');
        setSubmitting(false);
        return;
      }

      if (editingRole) {
        await updateRolePages(editingRole.id, roleFormData.pageIds);
        showSuccess('Role pages updated successfully');
      } else {
        const result = await createRole({
          name: roleFormData.name,
          description: roleFormData.description,
        });
        await updateRolePages(result.role.id, roleFormData.pageIds);
        showSuccess('Role created successfully');
      }

      setShowRoleModal(false);
      setEditingRole(null);
      resetRoleForm();
      fetchData();
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to save role');
    } finally {
      setSubmitting(false);
    }
  };

  const resetRoleForm = () => {
    setRoleFormData({
      name: '',
      description: '',
      pageIds: [],
    });
  };

  const handleEditRole = async (role) => {
    try {
      const pagesData = await getRolePages(role.id);
      setEditingRole(role);
      setRoleFormData({
        name: role.name,
        description: role.description || '',
        pageIds: pagesData.pages?.map((p) => p.id) || [],
      });
      setShowRoleModal(true);
    } catch (err) {
      showError('Failed to load role data');
    }
  };

  const handleDeleteRole = async (roleId, roleName, isSystemRole) => {
    if (isSystemRole) {
      showError('Cannot delete system role');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete role "${roleName}"?\n\nUsers with this role will lose it. This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteRole(roleId);
      showSuccess('Role deleted successfully');
      fetchData();
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to delete role');
    }
  };

  const handlePageToggle = (pageId) => {
    setRoleFormData((prev) => ({
      ...prev,
      pageIds: prev.pageIds.includes(pageId)
        ? prev.pageIds.filter((id) => id !== pageId)
        : [...prev.pageIds, pageId],
    }));
  };

  // Render page checkboxes hierarchically
  const renderPageCheckboxes = () => {
    const topLevelPages = pages.filter((p) => p.parent_page_id === null);
    const childPages = pages.filter((p) => p.parent_page_id !== null);

    return topLevelPages.map((page) => {
      const children = childPages.filter((c) => c.parent_page_id === page.id);
      return (
        <div key={page.id} className="mb-2">
          <label className="flex items-center gap-2 font-semibold">
            <input
              type="checkbox"
              checked={roleFormData.pageIds.includes(page.id)}
              onChange={() => handlePageToggle(page.id)}
              className="h-4 w-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:focus:ring-blue-400"
            />
            <span className="text-sm text-gray-900">{page.display_name}</span>
          </label>
          {children.length > 0 && (
            <div className="ml-6 mt-1 space-y-1">
              {children.map((child) => (
                <label key={child.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={roleFormData.pageIds.includes(child.id)}
                    onChange={() => handlePageToggle(child.id)}
                    className="h-4 w-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                  <span className="text-sm text-gray-700">{child.display_name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      );
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div id="page-user-management" className="space-y-6">
      {/* Alert Messages */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage user accounts, roles, and permissions
          </p>
        </div>
      </div>

      {/* Users Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Users</h2>
          <button
            onClick={() => {
              resetUserForm();
              setEditingUser(null);
              setShowUserModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="h-5 w-5" />
            Create User
          </button>
        </div>

        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Roles
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Last Login
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <UserIcon className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{user.full_name}</p>
                      <p className="text-xs text-gray-500">{user.username}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {user.roles?.map((role) => (
                      <span
                        key={role.id}
                        className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:text-blue-300 dark:text-blue-300 border border-blue-200"
                      >
                        {role.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      user.is_active
                        ? 'bg-green-100 text-green-800 border border-green-200'
                        : 'bg-red-100 text-red-800 border border-red-200'
                    }`}
                  >
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {user.last_login_at
                    ? new Date(user.last_login_at).toLocaleString()
                    : 'Never'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleEditUser(user)}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:text-blue-300 dark:text-blue-300 transition-colors"
                      title="Edit User"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleChangePassword(user.id, user.username)}
                      className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 dark:text-gray-100 transition-colors"
                      title="Change Password"
                    >
                      <KeyIcon className="h-5 w-5" />
                    </button>
                    {user.id !== currentUser?.id && (
                      <button
                        onClick={() => handleDeleteUser(user.id, user.username)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:text-red-300 transition-colors"
                        title="Delete User"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Roles Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Roles</h2>
          <button
            onClick={() => {
              resetRoleForm();
              setEditingRole(null);
              setShowRoleModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="h-5 w-5" />
            Create Role
          </button>
        </div>

        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Role Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200">
            {roles.map((role) => (
              <tr key={role.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <ShieldCheckIcon className="h-5 w-5 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900">{role.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {role.description || <em className="text-gray-400">No description</em>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      role.is_system_role
                        ? 'bg-purple-100 text-purple-800 border border-purple-200'
                        : 'bg-gray-100 text-gray-800 border border-gray-200'
                    }`}
                  >
                    {role.is_system_role ? 'System' : 'Custom'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleEditRole(role)}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:text-blue-300 dark:text-blue-300 transition-colors"
                      title="Edit Pages"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    {!role.is_system_role && (
                      <button
                        onClick={() => handleDeleteRole(role.id, role.name, role.is_system_role)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:text-red-300 transition-colors"
                        title="Delete Role"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {editingUser ? 'Edit User' : 'Create User'}
              </h2>
              <button
                onClick={() => {
                  setShowUserModal(false);
                  setEditingUser(null);
                  resetUserForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleUserSubmit} className="space-y-4">
              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    required
                    value={userFormData.username}
                    onChange={(e) =>
                      setUserFormData({ ...userFormData, username: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Lowercase letters, numbers, dots, dashes, underscores
                  </p>
                </div>
              )}

              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={userFormData.password}
                    onChange={(e) =>
                      setUserFormData({ ...userFormData, password: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Minimum 8 characters</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={userFormData.full_name}
                  onChange={(e) =>
                    setUserFormData({ ...userFormData, full_name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Roles *</label>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  {roles.map((role) => (
                    <label key={role.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={userFormData.roleIds.includes(role.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setUserFormData({
                              ...userFormData,
                              roleIds: [...userFormData.roleIds, role.id],
                            });
                          } else {
                            setUserFormData({
                              ...userFormData,
                              roleIds: userFormData.roleIds.filter((id) => id !== role.id),
                            });
                          }
                        }}
                        className="h-4 w-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:focus:ring-blue-400"
                      />
                      <span className="text-sm text-gray-700">
                        {role.name}
                        {role.description && (
                          <span className="text-gray-500"> - {role.description}</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {editingUser && (
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userFormData.is_active}
                      onChange={(e) =>
                        setUserFormData({ ...userFormData, is_active: e.target.checked })
                      }
                      className="h-4 w-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:focus:ring-blue-400"
                    />
                    <span className="text-sm font-medium text-gray-700">Active</span>
                  </label>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting
                    ? 'Saving...'
                    : editingUser
                    ? 'Update User'
                    : 'Create User'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUserModal(false);
                    setEditingUser(null);
                    resetUserForm();
                  }}
                  className="flex-1 px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-900 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Change Password</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">For: {passwordUsername}</p>
              </div>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordUserId(null);
                  setNewPassword('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  New Password *
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Minimum 8 characters</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? 'Changing...' : 'Change Password'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordUserId(null);
                    setNewPassword('');
                  }}
                  className="flex-1 px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-900 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Role Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {editingRole ? 'Edit Role Pages' : 'Create Role'}
              </h2>
              <button
                onClick={() => {
                  setShowRoleModal(false);
                  setEditingRole(null);
                  resetRoleForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleRoleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role Name *
                </label>
                <input
                  type="text"
                  required
                  value={roleFormData.name}
                  onChange={(e) =>
                    setRoleFormData({ ...roleFormData, name: e.target.value })
                  }
                  disabled={editingRole !== null}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 disabled:bg-gray-100 dark:bg-gray-700 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Lowercase letters, numbers, hyphens, underscores
                </p>
              </div>

              {!editingRole && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={roleFormData.description}
                    onChange={(e) =>
                      setRoleFormData({ ...roleFormData, description: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Brief description of this role's purpose
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Page Access *
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Select which pages this role can access
                </p>
                <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 max-h-80 overflow-y-auto">
                  {renderPageCheckboxes()}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? 'Saving...' : editingRole ? 'Update Role' : 'Create Role'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRoleModal(false);
                    setEditingRole(null);
                    resetRoleForm();
                  }}
                  className="flex-1 px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-900 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;

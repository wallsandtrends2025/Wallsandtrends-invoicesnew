/**
 * Backup Manager Component
 * Provides UI for management team to view backup history and trigger manual backups
 * Only accessible to management team members
 */

import { useEffect, useState } from 'react';
import BackupService from '../utils/backupService';
import { authService } from '../utils/authService.jsx';

export default function BackupManager() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [backupLoading, setBackupLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadBackupHistory();
  }, []);

  const loadBackupHistory = async () => {
    try {
      setLoading(true);
      const history = await BackupService.getBackupHistory();
      setBackups(history);
    } catch (err) {
      console.error('Failed to load backup history:', err);
      setError('Failed to load backup history');
    } finally {
      setLoading(false);
    }
  };

  const handleManualBackup = async () => {
    try {
      setBackupLoading(true);
      setError(null);
      await BackupService.triggerManualBackup();
      await loadBackupHistory(); // Refresh the list
      alert('Manual backup completed successfully!');
    } catch (err) {
      console.error('Manual backup failed:', err);
      setError('Manual backup failed: ' + err.message);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleDownloadBackup = async (backup) => {
    try {
      await BackupService.downloadBackup(backup);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Download failed: ' + err.message);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata'
    });
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="bg-[#F4F6FF] p-[10px]">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white shadow-sm mb-4 p-[15px] rounded-xl">
            <h2 className="font-semibold text-[#000000] m-[0]">Backup Manager</h2>
          </div>
          <div className="bg-white shadow-md rounded-xl p-8 text-center">
            <div className="text-gray-600">Loading backup history...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F4F6FF] p-[10px]">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white shadow-sm mb-4 p-[15px] rounded-xl flex justify-between items-center">
          <h2 className="font-semibold text-[#000000] m-[0]">Backup Manager</h2>
          {authService.isManagement() && (
            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
              Management Team Access
            </span>
          )}
        </div>

        {/* Manual Backup Button */}
        <div className="bg-white shadow-md rounded-xl p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Manual Backup</h3>
              <p className="text-gray-600 text-sm">
                Trigger an immediate backup of all system data to Firebase Storage
              </p>
            </div>
            <button
              onClick={handleManualBackup}
              disabled={backupLoading}
              className="bg-[#3b5997] text-white font-semibold rounded-lg px-6 py-3 hover:bg-[#2d4373] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {backupLoading ? 'Running Backup...' : 'Run Manual Backup'}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Backup History */}
        <div className="bg-white shadow-md rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Backup History</h3>

          {backups.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No backups found. The system will automatically create daily backups when management team members are active.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Collections
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {backups.map((backup) => (
                    <tr key={backup.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(backup.timestamp)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          backup.status === 'SUCCESS'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {backup.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {backup.totalCollections || backup.collections?.length || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatFileSize(backup.fileSize)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {backup.processingTimeMs ? `${Math.round(backup.processingTimeMs / 1000)}s` : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {backup.clientSide ? 'Client' : 'Server'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {backup.status === 'SUCCESS' && backup.fileName && (
                          <button
                            onClick={() => handleDownloadBackup(backup)}
                            className="text-[#3b5997] hover:text-[#2d4373] font-medium"
                          >
                            Download
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mt-6">
          <h4 className="text-lg font-semibold text-blue-900 mb-2">Backup Information</h4>
          <ul className="text-blue-800 text-sm space-y-1">
            <li>• <strong>Automatic:</strong> Daily backups run when management team members are active</li>
            <li>• <strong>Storage:</strong> Backups are stored in Firebase Storage (free tier compatible)</li>
            <li>• <strong>Encryption:</strong> All backups are encrypted before storage</li>
            <li>• <strong>Retention:</strong> Old backups are automatically cleaned up after 7 days</li>
            <li>• <strong>Collections:</strong> Includes all business data (invoices, clients, projects, etc.)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
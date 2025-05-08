import React, { useEffect, useRef } from 'react';

const EditNodeModal = ({ node, isOpen, onClose, onSave }) => {
  const dialogRef = useRef(null);
  const initialFocusRef = useRef(null);

  // Form state management
  const [formData, setFormData] = React.useState({
    label: node?.data?.label || '',
    // Add more fields based on node type
    ...(node?.type === 'referenceNode' && {
      fullText: node?.data?.fullText || ''
    }),
    ...(node?.type === 'paperNode' && {
      importance: node?.data?.importance || 0,
      notes: node?.data?.notes || ''
    }),
    ...(node?.type === 'topicNode' && {
      siblingOrder: node?.data?.siblingOrder || 1
    })
  });

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal();
      initialFocusRef.current?.focus();
    } else {
      dialogRef.current?.close();
    }
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onKeyDown={handleKeyDown}
      className="rounded-lg p-4 shadow-xl backdrop:bg-black/50"
      aria-labelledby="edit-node-title"
    >
      <h2 id="edit-node-title" className="text-xl font-semibold mb-3">
        Edit {node?.type.replace('Node', '')}
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="label" className="block text-sm font-medium text-gray-700">
            Label
          </label>
          <input
            ref={initialFocusRef}
            type="text"
            id="label"
            name="label"
            value={formData.label}
            onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
          />
        </div>

        {node?.type === 'referenceNode' && (
          <div>
            <label htmlFor="fullText" className="block text-sm font-medium text-gray-700">
              Full Text
            </label>
            <textarea
              id="fullText"
              name="fullText"
              value={formData.fullText}
              onChange={(e) => setFormData(prev => ({ ...prev, fullText: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              rows={4}
            />
          </div>
        )}

        {node?.type === 'paperNode' && (
          <>
            <div>
              <label htmlFor="importance" className="block text-sm font-medium text-gray-700">
                Importance (1-10)
              </label>
              <input
                type="number"
                id="importance"
                name="importance"
                min="0"
                max="10"
                value={formData.importance}
                onChange={(e) => setFormData(prev => ({ ...prev, importance: Math.max(0, Math.min(10, parseInt(e.target.value) || 0)) }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                rows={4}
              />
            </div>
          </>
        )}

        {node?.type === 'topicNode' && (
          <div>
            <label htmlFor="siblingOrder" className="block text-sm font-medium text-gray-700">
              Sequence Order
            </label>
            <input
              type="number"
              id="siblingOrder"
              name="siblingOrder"
              min="1"
              value={formData.siblingOrder}
              onChange={(e) => setFormData(prev => ({ ...prev, siblingOrder: parseInt(e.target.value) || 1 }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        )}

        <div className="flex justify-end space-x-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-3 py-1.5 rounded-md border border-transparent bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Save Changes
          </button>
        </div>
      </form>
    </dialog>
  );
};

export default EditNodeModal;
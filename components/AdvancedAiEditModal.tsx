import React, { useState, useEffect } from 'react';
import { Spinner } from './Spinner';
import { getRepoWorkflows, commitFile } from '../services/githubService';
import { Workflow } from '../types';

interface AdvancedAiEditModalProps {
  onClose: () => void;
  onSubmit: (instruction: string, workflowId: string) => Promise<void>;
  token: string | null;
  repoFullName: string;
}

export const AdvancedAiEditModal: React.FC<AdvancedAiEditModalProps> = ({ onClose, onSubmit, token, repoFullName }) => {
  const [instruction, setInstruction] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>('');
  const [loadingWorkflows, setLoadingWorkflows] = useState(true);
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState(false);

  const WORKFLOW_PATH = '.github/workflows/ai-automation.yml';
  const WORKFLOW_CONTENT = `name: AI Automation

on:
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install dependencies
        run: npm install
      - name: Run Build
        run: npm run build
`;

  useEffect(() => {
    fetchWorkflows();
  }, [token, repoFullName]);

  const fetchWorkflows = async () => {
    if (token && repoFullName) {
      try {
        setLoadingWorkflows(true);
        const [owner, repo] = repoFullName.split('/');
        const response = await getRepoWorkflows(token, owner, repo);
        const activeWorkflows = response.workflows.filter(w => w.state === 'active');
        setWorkflows(activeWorkflows);
        if (activeWorkflows.length > 0) {
          setSelectedWorkflow(String(activeWorkflows[0].id)); // Select the first one by default
        }
      } catch (error) {
        console.error("Failed to fetch workflows", error);
      } finally {
        setLoadingWorkflows(false);
      }
    }
  };

  const handleCreateWorkflow = async () => {
      if (!token || isCreatingWorkflow) return;
      try {
          setIsCreatingWorkflow(true);
          const [owner, repo] = repoFullName.split('/');
          await commitFile({
              token,
              owner,
              repo,
              path: WORKFLOW_PATH,
              content: WORKFLOW_CONTENT,
              message: 'Adding AI Automation workflow',
              branch: 'main' // default to main
          });
          // Wait a bit for GitHub to index the new workflow
          await new Promise(r => setTimeout(r, 3000));
          await fetchWorkflows();
      } catch (error: any) {
          console.error("Failed to create workflow", error);
          alert("Failed to create workflow: " + error.message);
      } finally {
          setIsCreatingWorkflow(false);
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instruction.trim() || isLoading || !selectedWorkflow) return;
    setIsLoading(true);
    await onSubmit(instruction, selectedWorkflow);
    // The parent will close the modal upon completion/start of the next phase
  };

  return (
    <div className="fixed inset-0 bg-gray-950 bg-opacity-70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-850 p-6 rounded-lg shadow-2xl w-full max-w-2xl border border-gray-700" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-indigo-400 mb-4">Advanced AI Edit & Test</h2>
        <div className="bg-blue-900 border border-blue-700 text-blue-200 p-4 rounded-md mb-6 text-sm space-y-2">
            <p><strong>This is a autonomous AI swarm agent.</strong></p>
            <ul className="list-disc list-inside">
                <li>It cross-references multiple models for architectural integrity.</li>
                <li>It performs massive commits to implement complete feature sets.</li>
                <li>It <strong>verifies its work</strong> by running your GitHub Actions.</li>
                <li>If the build fails, it analyzes logs and attempts repair.</li>
            </ul>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="instruction-advanced" className="block text-sm font-medium text-gray-300 mb-2">
              Your Request
            </label>
            <textarea
                id="instruction-advanced"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="e.g., 'Refactor the authentication logic to use a context provider instead of prop drilling.'"
                className="w-full h-40 bg-gray-900 p-3 rounded-md text-sm border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                autoFocus
            />
          </div>
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
                <label htmlFor="workflow-select" className="block text-sm font-medium text-gray-300">
                Select Workflow for Verification
                </label>
                {workflows.length === 0 && !loadingWorkflows && (
                    <button 
                        type="button"
                        onClick={handleCreateWorkflow}
                        disabled={isCreatingWorkflow}
                        className="text-[10px] bg-indigo-900/50 hover:bg-indigo-800 text-indigo-300 px-2 py-1 rounded border border-indigo-700 flex items-center gap-1 transition-colors"
                    >
                        {isCreatingWorkflow ? <Spinner className="w-3 h-3" /> : 'Add Verification Workflow'}
                    </button>
                )}
            </div>
            {loadingWorkflows ? (
                 <div className="flex items-center gap-2 text-gray-400">
                    <Spinner className="w-4 h-4" />
                    <span>Loading workflows...</span>
                </div>
            ) : workflows.length > 0 ? (
                <select
                    id="workflow-select"
                    value={selectedWorkflow}
                    onChange={(e) => setSelectedWorkflow(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    {workflows.map(wf => (
                        <option key={wf.id} value={wf.id}>{wf.name} ({wf.path.split('/').pop()})</option>
                    ))}
                </select>
            ) : (
                <div className="text-sm text-yellow-400 bg-yellow-900/30 p-3 rounded-md border border-yellow-700/50">
                    <p className="mb-2">No active GitHub Actions workflows found.</p>
                    <p className="text-[11px] text-yellow-500/80">Automated verification requires a workflow file in <code>.github/workflows/</code> with <code>workflow_dispatch</code> enabled.</p>
                </div>
            )}
          </div>
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white font-semibold rounded-md hover:bg-gray-700 disabled:opacity-50"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
               type="submit"
               disabled={isLoading || !instruction.trim() || !selectedWorkflow}
               className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors flex items-center justify-center min-w-[120px]"
            >
              {isLoading ? <Spinner /> : 'Execute & Test'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

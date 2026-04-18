import React from 'react';
import { ProjectExpansionJob, ProjectExpansionPhase, AIWorkerStatus } from '../types';
import { Spinner } from './Spinner';

const StatusIcon: React.FC<{ status: ProjectExpansionJob['status'] }> = ({ status }) => {
    switch (status) {
        case 'queued': 
            return <div title="Queued" className="w-4 h-4 rounded-full bg-gray-600 flex-shrink-0"></div>;
        case 'generating': 
            return <Spinner className="w-4 h-4 text-blue-400" />;
        case 'committing': 
            return <Spinner className="w-4 h-4 text-yellow-400" />;
        case 'retrying':
            return <Spinner className="w-4 h-4 text-orange-400" />;
        case 'success': 
            return <div title="Success" className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">✓</div>;
        case 'failed': 
            return <div title="Failed" className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">!</div>;
        default: 
            return null;
    }
};

const WorkerGrid: React.FC<{ workers?: AIWorkerStatus[] }> = ({ workers }) => {
    if (!workers) return null;
    return (
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1 mt-2">
            {workers.map((w, i) => (
                <div 
                    key={i} 
                    title={`${w.model}: ${w.status}`}
                    className={`w-2 h-2 rounded-sm transition-all duration-300 ${
                        w.status === 'working' ? 'bg-purple-500 animate-pulse shadow-[0_0_5px_rgba(168,85,247,0.5)]' :
                        w.status === 'finished' ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]' :
                        w.status === 'failed' ? 'bg-red-500' :
                        'bg-gray-700'
                    }`}
                />
            ))}
        </div>
    );
};

interface ProjectExpansionProgressProps {
  jobs: ProjectExpansionJob[];
  phase: ProjectExpansionPhase;
  onClose: () => void;
  isComplete: boolean;
}

const PhaseIndicator: React.FC<{title: string, isActive: boolean, isComplete: boolean}> = ({ title, isActive, isComplete }) => (
    <div className="flex items-center gap-2">
        {isActive && <Spinner className="h-4 w-4" />}
        {isComplete && <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">✓</div>}
        <span className={isActive ? "text-purple-300 font-bold" : isComplete ? "text-gray-300" : "text-gray-600"}>{title}</span>
    </div>
);

export const ProjectExpansionProgress: React.FC<ProjectExpansionProgressProps> = ({ jobs, phase, onClose, isComplete }) => {
  const completedCount = jobs.filter(j => j.status === 'success' || j.status === 'failed').length;
  const successCount = jobs.filter(j => j.status === 'success').length;
  const progress = jobs.length > 0 ? (completedCount / jobs.length) * 100 : 0;
  
  const activeJobs = jobs.filter(j => j.status === 'generating' || j.status === 'committing' || j.status === 'retrying');

  const getStatusMessage = () => {
    switch(phase) {
        case 'planning': return 'Orchestrating architectural expansion plan...';
        case 'generating': return `Manifesting ${jobs.length} neural nodes...`;
        case 'complete': return 'Synaptic expansion successful.';
        default: return 'Initializing...';
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-950 bg-opacity-80 flex items-center justify-center z-50">
      <div className="bg-gray-850 p-6 rounded-lg shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col border border-gray-700">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
            <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold text-purple-400">AI Swarm Expansion</h2>
                <div className="flex items-center gap-2 bg-gray-900 px-3 py-1 rounded-full border border-gray-700">
                    <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
                    <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">Multi-Agent Collective</span>
                </div>
            </div>
            {isComplete && (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 text-white font-semibold rounded-md hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            )}
        </div>
        
        <div className="mb-4 flex-shrink-0 space-y-4">
            <div className="flex items-center justify-around p-3 bg-gray-900 rounded-xl border border-gray-800">
                <PhaseIndicator title="Neural Planning" isActive={phase === 'planning'} isComplete={['generating', 'complete'].includes(phase)} />
                <div className="flex-grow h-px bg-gray-800 mx-8"></div>
                <PhaseIndicator title="Swarm Execution" isActive={phase === 'generating'} isComplete={phase === 'complete'} />
            </div>
             <div className="flex justify-between text-sm text-gray-300 mb-1">
                <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-tight">
                    {phase !== 'complete' && <Spinner className="h-4 w-4" />}
                    {getStatusMessage()}
                </span>
                <span className="font-mono text-purple-400">{`${successCount} / ${jobs.length} synced`}</span>
            </div>
            <div className="w-full bg-gray-900 rounded-full h-1.5 overflow-hidden">
                <div className="bg-gradient-to-r from-purple-700 to-indigo-500 h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${progress}%` }}></div>
            </div>
        </div>
        
        {phase === 'planning' ? (
             <div className="flex-grow min-h-0 bg-gray-900 rounded-2xl p-4 flex items-center justify-center border border-gray-800 shadow-inner">
                <div className="text-center group">
                    <div className="relative mb-6">
                        <div className="absolute inset-0 bg-purple-500 blur-xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
                        <Spinner className="h-16 w-16 mx-auto text-purple-500" />
                    </div>
                    <p className="font-mono text-gray-400 mb-1 uppercase tracking-[0.2em]">Analyzing Root Parameters</p>
                    <p className="text-[10px] text-gray-600 font-mono uppercase tracking-[0.3em]">Synaptogenesis in progress...</p>
                </div>
             </div>
        ) : (
            <div className="grid grid-cols-12 gap-6 flex-grow min-h-0">
                <div className="col-span-3 bg-gray-900 rounded-2xl p-4 overflow-y-auto border border-gray-800 custom-scrollbar shadow-inner">
                    <h3 className="text-[10px] font-black mb-4 text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-2">Expansion Sequence</h3>
                    <ul className="space-y-2">
                        {jobs.map(job => (
                            <li key={job.id} className={`flex flex-col gap-1 p-3 rounded-xl border transition-all ${
                                job.status === 'generating' || job.status === 'committing' || job.status === 'retrying' ? 'bg-purple-900/10 border-purple-700/50' : 
                                job.status === 'success' ? 'bg-green-900/5 border-green-700/20' :
                                'bg-gray-850 border-gray-800'
                            }`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <StatusIcon status={job.status} />
                                        {job.type === 'edit' ? 
                                            <span className="text-[9px] font-bold text-yellow-400/80 bg-yellow-900/30 px-1.5 py-0.5 rounded border border-yellow-700/30">EDIT</span> :
                                            <span className="text-[9px] font-bold text-purple-400 bg-purple-900/30 px-1.5 py-0.5 rounded border border-purple-700/30">NEW</span>
                                        }
                                        <span className="truncate text-xs font-mono text-gray-300" title={job.path}>{job.path.split('/').pop()}</span>
                                    </div>
                                </div>
                                <WorkerGrid workers={job.workers} />
                                {job.error && <span className="text-red-400 text-[9px] font-mono mt-1 break-words leading-tight">{job.error}</span>}
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="col-span-9 bg-gray-900 rounded-2xl p-4 flex flex-col border border-gray-800 shadow-2xl">
                    <div className="flex justify-between items-baseline mb-4 border-b border-gray-800 pb-2">
                        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Active Neural Streams ({activeJobs.length})</h3>
                        <span className="text-[9px] font-mono text-purple-500/50">COORDINATION: FULL-SWARM MODE</span>
                    </div>
                    {activeJobs.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-grow min-h-0">
                        {activeJobs.slice(0, 9).map(job => (
                            <div key={job.id} className="flex flex-col min-h-0 bg-gray-850 rounded-xl overflow-hidden border border-gray-700/50 hover:border-purple-500/30 transition-colors shadow-sm">
                                <div className="bg-gray-800/80 px-3 py-2 flex justify-between items-center border-b border-gray-700">
                                    <p className="text-purple-400 font-mono text-[9px] font-bold truncate max-w-[70%]" title={job.path}>
                                        {job.path}
                                    </p>
                                    <span className="text-[8px] font-mono bg-indigo-900/50 text-indigo-300 px-1 px-0.5 rounded">ID:{job.agentIndex}</span>
                                </div>
                                <div className="p-3 bg-gray-950 flex-grow font-mono overflow-y-auto custom-scrollbar-purple">
                                        <pre className="text-[10px] text-purple-100/80 whitespace-pre-wrap leading-relaxed animate-in slide-in-from-left-2 duration-300">
                                            <code>{job.content || "Streaming neural data..."}</code>
                                        </pre>
                                </div>
                                {job.workers && (
                                    <div className="bg-gray-800/40 px-2 py-1 border-t border-gray-700">
                                        <WorkerGrid workers={job.workers} />
                                    </div>
                                )}
                            </div>
                        ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-700 gap-4 opacity-40">
                            <div className="p-8 rounded-full border border-gray-800/50 bg-gray-850">
                                 {isComplete ? <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 13l4 4L19 7" /></svg> : <Spinner className="w-12 h-12" />}
                            </div>
                            <p className="font-mono text-[10px] uppercase tracking-[0.5em]">
                                {isComplete ? "COLLECTIVE STATE STABILIZED" : "POISED FOR DISTRIBUTION"}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

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
  reasonings?: string[];
  onClose: () => void;
  isComplete: boolean;
}

const PhaseIndicator: React.FC<{title: string, isActive: boolean, isComplete: boolean}> = ({ title, isActive, isComplete }) => (
    <div className="flex items-center gap-2">
        {isActive && <Spinner className="h-4 w-4 text-purple-400" />}
        {isComplete && <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">✓</div>}
        {!isActive && !isComplete && <div className="w-4 h-4 rounded-full bg-gray-800 border border-gray-700 flex-shrink-0"></div>}
        <span className={isActive ? "text-purple-300 font-bold" : isComplete ? "text-gray-300" : "text-gray-600"}>{title}</span>
    </div>
);

export const ProjectExpansionProgress: React.FC<ProjectExpansionProgressProps> = ({ jobs, phase, reasonings = [], onClose, isComplete }) => {
  const completedCount = jobs.filter(j => j.status === 'success' || j.status === 'failed').length;
  const successCount = jobs.filter(j => j.status === 'success').length;
  const progress = jobs.length > 0 ? (completedCount / jobs.length) * 100 : 0;
  
  const activeJobs = jobs.filter(j => j.status === 'generating' || j.status === 'committing' || j.status === 'retrying');
  const currentFocusJob = activeJobs[0] || jobs.find(j => j.status === 'queued') || jobs[jobs.length - 1];

  const getStatusMessage = () => {
    switch(phase) {
        case 'planning': return 'Orchestrating architectural expansion plan...';
        case 'generating': return `Manifesting ${jobs.reduce((acc, j) => acc + j.batch.files.length, 0)} neural nodes across ${jobs.length} batches...`;
        case 'complete': return 'Synaptic expansion successful.';
        default: return 'Initializing...';
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-950 bg-opacity-90 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 p-6 rounded-2xl shadow-[0_0_50px_rgba(168,85,247,0.15)] w-full max-w-7xl h-full max-h-[95vh] flex flex-col border border-gray-800 relative overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/5 blur-[100px] -z-10 rounded-full"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-600/5 blur-[100px] -z-10 rounded-full"></div>

        <div className="flex justify-between items-center mb-6 flex-shrink-0">
            <div className="flex items-center gap-6">
                <div className="relative">
                    <div className="absolute inset-0 bg-purple-500 blur-md opacity-20 animate-pulse"></div>
                    <h2 className="text-3xl font-black bg-gradient-to-r from-purple-400 via-white to-indigo-400 bg-clip-text text-transparent uppercase tracking-tighter">
                        Architect Swarm Expansion
                    </h2>
                </div>
                <div className="flex items-center gap-3 bg-gray-950 px-4 py-1.5 rounded-full border border-gray-800 shadow-inner">
                    <div className="flex gap-1">
                        <div className="w-1 h-3 bg-purple-500 rounded-full animate-[bounce_1s_infinite_0ms]"></div>
                        <div className="w-1 h-3 bg-purple-400 rounded-full animate-[bounce_1s_infinite_200ms]"></div>
                        <div className="w-1 h-3 bg-purple-300 rounded-full animate-[bounce_1s_infinite_400ms]"></div>
                    </div>
                    <span className="text-[10px] font-mono font-black text-purple-400 tracking-[0.2em] uppercase">Collective Intelligence</span>
                </div>
            </div>
            {isComplete && (
              <button
                onClick={onClose}
                className="px-8 py-2 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-500 transition-all hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] active:scale-95"
              >
                CLOSE INTERFACE
              </button>
            )}
        </div>
        
        <div className="mb-6 flex-shrink-0 space-y-4">
            <div className="flex items-center justify-between px-6 py-3 bg-gray-950 rounded-2xl border border-gray-800 shadow-inner">
                <PhaseIndicator title="Neural Planning" isActive={phase === 'planning'} isComplete={['generating', 'complete'].includes(phase)} />
                <div className={`flex-grow h-0.5 mx-8 ${['generating', 'complete'].includes(phase) ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'bg-gray-800'}`}></div>
                <PhaseIndicator title="Mass Manifestation" isActive={phase === 'generating'} isComplete={phase === 'complete'} />
                <div className={`flex-grow h-0.5 mx-8 ${phase === 'complete' ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'bg-gray-800'}`}></div>
                <PhaseIndicator title="Stabilized State" isActive={false} isComplete={phase === 'complete'} />
            </div>
             <div className="flex justify-between items-baseline mb-1">
                <span className="flex items-center gap-2 font-mono text-xs text-gray-400 font-bold uppercase tracking-tight">
                    <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
                    {getStatusMessage()}
                </span>
                <span className="font-mono text-purple-400 text-xs font-bold">{`${successCount} / ${jobs.length} BATCHES SYNCED`}</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden shadow-inner">
                <div className="bg-gradient-to-r from-purple-700 via-indigo-500 to-purple-400 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${progress}%` }}></div>
            </div>
        </div>
        
        <div className="grid grid-cols-12 gap-6 flex-grow min-h-0">
            {/* Swarm Thoughts & Job List */}
            <div className="col-span-4 flex flex-col min-h-0 gap-4">
                {reasonings.length > 0 && (
                     <div className="bg-gray-950/50 rounded-2xl border border-gray-800 p-4 flex flex-col min-h-0 shadow-inner">
                        <h3 className="text-[10px] font-black text-purple-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                             Architectural Collective Strategy
                        </h3>
                        <div className="flex-grow overflow-y-auto custom-scrollbar space-y-4 pr-2">
                            {reasonings.map((r, i) => (
                                <div key={i} className="text-gray-400 text-[11px] leading-relaxed font-mono italic border-l-2 border-purple-900 pl-3 py-1 bg-purple-900/5 rounded-r-lg">
                                    {r}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="bg-gray-950/80 rounded-2xl border border-gray-800 p-4 overflow-y-auto flex-grow min-h-0 custom-scrollbar shadow-inner">
                    <h3 className="text-[10px] font-black mb-4 text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-2">Expansion Topology</h3>
                    <ul className="space-y-2">
                        {jobs.map(job => (
                            <li key={job.id} className={`flex flex-col gap-1.5 p-3 rounded-xl border transition-all ${
                                job.status === 'generating' || job.status === 'committing' || job.status === 'retrying' ? 'bg-purple-900/20 border-purple-700 shadow-[0_0_15px_rgba(168,85,247,0.1)]' : 
                                job.status === 'success' ? 'bg-green-950/20 border-green-900/50 opacity-80' :
                                'bg-gray-900 border-gray-800'
                            }`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <StatusIcon status={job.status} />
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="text-[8px] font-bold text-purple-400 bg-purple-900/30 px-1.5 py-0.5 rounded border border-purple-700/30 uppercase">B-{job.batch.agentIndex}</span>
                                            <span className="truncate text-[11px] font-mono font-bold text-gray-300" title={job.batch.files.map(f => f.path).join(', ')}>
                                                {job.batch.files.length} Files: {job.batch.files[0].path.split('/').pop()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <WorkerGrid workers={job.workers} />
                                {job.error && <span className="text-red-400 text-[9px] font-mono mt-1 break-words leading-tight">{job.error}</span>}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Neural Streams */}
            <div className="col-span-8 bg-gray-950/80 rounded-3xl border border-gray-800 p-4 flex flex-col min-h-0 shadow-2xl relative">
                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                     <svg className="w-80 h-80 text-purple-500" fill="currentColor" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="0.5" fill="none" />
                        <path d="M50 5 L50 95 M5 50 L95 50" stroke="currentColor" strokeWidth="0.5" />
                        <circle cx="50" cy="50" r="2" fill="currentColor" />
                    </svg>
                </div>

                <div className="flex justify-between items-baseline mb-4 border-b border-gray-900 pb-2 z-10">
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                        Neural Stream: {currentFocusJob?.batch.files[0].path || 'COLLECTIVE IDLE'}
                    </h3>
                    <span className="text-[9px] font-mono text-purple-500/50">SYNAPTIC THROTTLE: UNRESTRICTED</span>
                </div>

                {activeJobs.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-grow min-h-0 overflow-y-auto custom-scrollbar pr-2">
                        {activeJobs.slice(0, 4).map(job => (
                            <div key={job.id} className="flex flex-col min-h-0 bg-black/40 rounded-2xl overflow-hidden border border-gray-800 hover:border-purple-500/30 transition-all shadow-lg group">
                                <div className="bg-gray-900/80 px-4 py-2.5 flex justify-between items-center border-b border-gray-800">
                                    <p className="text-purple-400 font-mono text-[10px] font-bold truncate max-w-[80%]" title={job.batch.files.map(f => f.path).join(', ')}>
                                        {job.batch.files[0].path} {job.batch.files.length > 1 ? `(+${job.batch.files.length - 1})` : ''}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></div>
                                        <span className="text-[9px] font-mono bg-purple-900/50 text-purple-300 px-1.5 py-0.5 rounded border border-purple-700/30 font-bold">A-{job.batch.agentIndex}</span>
                                    </div>
                                </div>
                                {job.thought && (
                                    <div className="px-4 py-2 bg-purple-950/40 border-b border-gray-800 italic text-[10px] text-purple-300/70 font-mono">
                                        &ldquo;{job.thought}&rdquo;
                                    </div>
                                )}
                                <div className="p-4 flex-grow font-mono overflow-y-auto custom-scrollbar-purple bg-black/60">
                                        <pre className="text-[10px] text-purple-100/90 whitespace-pre-wrap leading-relaxed animate-in fade-in slide-in-from-left-2 duration-300">
                                            <code>{job.content || "Opening neural stream buffer..."}</code>
                                        </pre>
                                </div>
                                {job.workers && (
                                    <div className="bg-gray-900/50 p-3 border-t border-gray-800 flex justify-between items-center">
                                        <WorkerGrid workers={job.workers} />
                                        <span className="text-[8px] font-mono text-gray-500 uppercase tracking-tighter">Syncing...</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-700 gap-6 opacity-60 z-10">
                        <div className="p-12 rounded-full border border-purple-900/20 bg-gray-950 relative">
                            <div className="absolute inset-0 bg-purple-500 blur-3xl opacity-10 rounded-full animate-pulse"></div>
                             {isComplete ? (
                                <div className="relative">
                                    <div className="absolute inset-0 bg-green-500 blur-2xl opacity-20 rounded-full animate-pulse"></div>
                                    <svg className="w-16 h-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                             ) : (
                                <Spinner className="w-16 h-16 text-purple-900" />
                             )}
                        </div>
                        <div className="text-center space-y-2">
                            <p className="font-mono text-[11px] uppercase tracking-[0.5em] text-purple-300/50 font-black">
                                {isComplete ? "STATE STABILIZATION COMPLETE" : "AWAITING SWARM ASSIGNMENT"}
                            </p>
                            <p className="text-[9px] font-mono text-gray-600 uppercase tracking-widest">
                                {isComplete ? "All synaptic mappings persisted to core." : "Poised for mass neural distribution across topological map."}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { AdvancedEditJob, AdvancedEditPhase, AIWorkerStatus } from '../types';
import { Spinner } from './Spinner';
import { BotIcon } from './icons/BotIcon';

const StatusIcon: React.FC<{ status: AdvancedEditJob['status'] }> = ({ status }) => {
    switch (status) {
        case 'planning':
        case 'editing':
            return <Spinner className="w-4 h-4 text-blue-400" />;
        case 'verifying':
            return <Spinner className="w-4 h-4 text-yellow-400" />;
        case 'committing':
            return <Spinner className="w-4 h-4 text-orange-400" />;
        case 'success': 
            return <div title="Success" className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">✓</div>;
        case 'failed': 
            return <div title="Failed" className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">!</div>;
        default: 
             return <div title="Pending" className="w-4 h-4 rounded-full bg-gray-600 flex-shrink-0"></div>;
    }
};

const WorkerGrid: React.FC<{ workers?: AIWorkerStatus[] }> = ({ workers }) => {
    if (!workers) return null;
    return (
        <div className="grid grid-cols-12 md:grid-cols-23 gap-0.5 mt-1">
            {workers.map((w, i) => (
                <div 
                    key={i} 
                    title={`${w.model}: ${w.status}`}
                    className={`w-1.5 h-3 rounded-full transition-all duration-300 ${
                        w.status === 'working' ? 'bg-cyan-500 animate-pulse' :
                        w.status === 'finished' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] scale-110' :
                        w.status === 'failed' ? 'bg-red-900 border border-red-500' :
                        'bg-gray-800'
                    }`}
                />
            ))}
        </div>
    );
};

const PhaseIndicator: React.FC<{title: string, isActive: boolean, isComplete: boolean}> = ({ title, isActive, isComplete }) => (
    <div className="flex flex-col items-center gap-1 group">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
            isActive ? "bg-indigo-600 ring-4 ring-indigo-900 shadow-lg shadow-indigo-500/50" : 
            isComplete ? "bg-green-600" : "bg-gray-800"
        }`}>
            {isActive ? <Spinner className="h-5 w-5 text-white" /> : 
             isComplete ? <span className="text-white text-sm font-bold">✓</span> : 
             <div className="w-2 h-2 rounded-full bg-gray-600"></div>}
        </div>
        <span className={`text-[10px] uppercase font-bold tracking-widest transition-colors ${isActive ? "text-indigo-400" : isComplete ? "text-green-400" : "text-gray-600"}`}>
            {title}
        </span>
    </div>
);

interface AdvancedEditProgressProps {
  jobs: AdvancedEditJob[];
  phase: AdvancedEditPhase;
  verificationAttempt: number;
  buildLogs: string | null;
  workflowRunUrl: string | null;
  aiThought: string | null;
  deploymentUrl: string | null;
  onClose: () => void;
  isComplete: boolean;
}

export const AdvancedEditProgress: React.FC<AdvancedEditProgressProps> = ({ jobs, phase, verificationAttempt, buildLogs, workflowRunUrl, aiThought, deploymentUrl, onClose, isComplete }) => {
  const completedCount = jobs.filter(j => j.status === 'success').length;
  const progress = jobs.length > 0 ? (completedCount / jobs.length) * 100 : 0;
  
  const getStatusMessage = () => {
    switch(phase) {
        case 'analyzing': return 'Neural Context Injection...';
        case 'planning': return 'Architecting Global Edit Plan...';
        case 'editing': return `Synchronizing ${jobs.length} neural buffers...`;
        case 'committing': return 'Persisting swarm state to GitHub...';
        case 'triggering_workflow': return 'Firing CI Validation Swarm...';
        case 'waiting_for_workflow': return `Observing CI Environment (Cycle ${verificationAttempt})...`;
        case 'analyzing_failure': return `Anomalies detected in Cycle ${verificationAttempt}. Correcting...`;
        case 'complete': return 'Evolution complete. Verified state achieved.';
        default: return 'Waking neural interface...';
    }
  };

  const currentFocusJob = jobs.find(job => job.status === 'editing') || jobs.find(job => job.status === 'committing') || jobs[jobs.length - 1];

  return (
    <div className="fixed inset-0 bg-gray-950 bg-opacity-90 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 p-6 rounded-2xl shadow-[0_0_50px_rgba(79,70,229,0.15)] w-full max-w-7xl h-full max-h-[95vh] flex flex-col border border-gray-800 relative overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/5 blur-[100px] -z-10 rounded-full"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-600/5 blur-[100px] -z-10 rounded-full"></div>

        <div className="flex justify-between items-center mb-8 flex-shrink-0">
            <div className="flex items-center gap-6">
                <div className="relative">
                    <div className="absolute inset-0 bg-indigo-500 blur-md opacity-20 animate-pulse"></div>
                    <h2 className="text-3xl font-black bg-gradient-to-r from-indigo-400 via-white to-cyan-400 bg-clip-text text-transparent uppercase tracking-tighter">
                        Swarm Prime Edits
                    </h2>
                </div>
                <div className="flex items-center gap-3 bg-gray-950 px-4 py-1.5 rounded-full border border-gray-800 shadow-inner">
                    <div className="flex gap-1">
                        <div className="w-1 h-3 bg-indigo-500 rounded-full animate-[bounce_1s_infinite_0ms]"></div>
                        <div className="w-1 h-3 bg-indigo-400 rounded-full animate-[bounce_1s_infinite_200ms]"></div>
                        <div className="w-1 h-3 bg-indigo-300 rounded-full animate-[bounce_1s_infinite_400ms]"></div>
                    </div>
                    <span className="text-[10px] font-mono font-black text-indigo-400 tracking-[0.2em] uppercase">Phase Multiplier: x23</span>
                </div>
                {workflowRunUrl && (
                    <a href={workflowRunUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 group">
                        <div className="text-xs font-mono text-cyan-500 hover:text-cyan-300 transition-colors uppercase tracking-widest border-b border-cyan-800">
                            Satellite CI Stream
                        </div>
                        <svg className="w-3 h-3 text-cyan-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </a>
                )}
            </div>
            {isComplete && (
              <button 
                onClick={onClose} 
                className="px-8 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-500 transition-all hover:shadow-[0_0_20px_rgba(79,70,229,0.4)] active:scale-95"
              >
                CLOSE CONSOLE
              </button>
            )}
        </div>
        
        <div className="mb-8 flex-shrink-0">
            <div className="flex items-center justify-between mb-6">
                <PhaseIndicator title="Analyze" isActive={phase === 'analyzing'} isComplete={!['idle', 'analyzing'].includes(phase)} />
                <div className={`flex-grow h-0.5 mx-4 ${!['idle', 'analyzing', 'planning'].includes(phase) ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-gray-800'}`}></div>
                <PhaseIndicator title="Plan" isActive={phase === 'planning'} isComplete={!['idle', 'analyzing', 'planning'].includes(phase)} />
                <div className={`flex-grow h-0.5 mx-4 ${!['idle', 'analyzing', 'planning', 'editing'].includes(phase) ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-gray-800'}`}></div>
                <PhaseIndicator title="Swarm Edit" isActive={phase === 'editing'} isComplete={!['idle', 'analyzing', 'planning', 'editing', 'committing'].includes(phase)} />
                <div className={`flex-grow h-0.5 mx-4 ${!['idle', 'analyzing', 'planning', 'editing', 'committing'].includes(phase) ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-gray-800'}`}></div>
                <PhaseIndicator title="Persist" isActive={phase === 'committing' || phase === 'triggering_workflow'} isComplete={!['idle', 'analyzing', 'planning', 'editing', 'committing', 'triggering_workflow'].includes(phase)} />
                <div className={`flex-grow h-0.5 mx-4 ${phase === 'complete' ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-gray-800'}`}></div>
                <PhaseIndicator title="Verify CI" isActive={phase === 'waiting_for_workflow' || phase === 'analyzing_failure'} isComplete={phase === 'complete'} />
            </div>
             <div className="flex justify-between items-baseline mb-2">
                <span className="text-sm font-mono font-bold text-gray-400 group flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                    {getStatusMessage()}
                </span>
                <span className="text-xs font-mono text-indigo-400">{`${completedCount} / ${jobs.length} NODES VERIFIED`}</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-1 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-600 via-white to-cyan-400 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${progress}%` }}></div>
            </div>
        </div>
        
        <div className="grid grid-cols-12 gap-8 flex-grow min-h-0">
            <div className="col-span-4 flex flex-col min-h-0 gap-4">
                {aiThought && (
                    <div className="bg-gray-950/50 rounded-2xl border border-gray-800 p-4 flex flex-col min-h-0 shadow-inner">
                        <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                            <BotIcon className="w-4 h-4" />
                            Core Reasoning Engine
                        </h3>
                        <div className="flex-grow overflow-y-auto custom-scrollbar pr-2">
                            <p className="text-gray-400 text-xs leading-relaxed font-mono italic">
                                "{aiThought}"
                            </p>
                        </div>
                    </div>
                )}
                
                <div className="bg-gray-950/80 rounded-2xl border border-gray-800 p-4 flex flex-col flex-grow min-h-0">
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-3 border-b border-gray-900 pb-2">
                        Target Cluster ({jobs.length})
                    </h3>
                    <ul className="space-y-2 overflow-y-auto pr-2 custom-scrollbar">
                        {jobs.map(job => (
                            <li key={job.id} className={`flex flex-col gap-1.5 p-3 rounded-xl border transition-all ${
                                job.status === 'editing' ? 'bg-indigo-900/20 border-indigo-700 shadow-[0_0_15px_rgba(79,70,229,0.1)]' : 
                                job.status === 'success' ? 'bg-green-950/20 border-green-900/50 opacity-80' :
                                'bg-gray-900/50 border-gray-800'
                            }`}>
                               <div className="flex items-center justify-between">
                                   <div className="flex items-center gap-3 overflow-hidden">
                                       <StatusIcon status={job.status} />
                                       <span className="truncate text-xs font-mono font-bold text-gray-300" title={job.path}>{job.path.split('/').pop()}</span>
                                   </div>
                               </div>
                               <WorkerGrid workers={job.workers} />
                               {job.error && <span className="text-red-400 text-[10px] font-mono mt-1 break-words">{job.error}</span>}
                            </li>
                        ))}
                     </ul>
                </div>
            </div>

            <div className="col-span-8 bg-gray-950/80 rounded-3xl border border-gray-800 flex flex-col min-h-0 shadow-2xl relative">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                    <svg className="w-64 h-64 text-indigo-500" fill="currentColor" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="1" fill="none" />
                        <path d="M50 10 L50 90 M10 50 L90 50" stroke="currentColor" strokeWidth="0.5" />
                    </svg>
                </div>

                { isComplete && deploymentUrl ? (
                    <div className="h-full flex flex-col p-6 animate-in fade-in zoom-in-95 duration-700">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-green-400 uppercase tracking-tighter">Verified Artifact View</h3>
                            <a href={deploymentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-[10px] font-bold text-white px-4 py-1.5 rounded-full transition-all shadow-lg shadow-indigo-500/20 active:scale-95">
                                OPEN EXTERNAL PORT &rarr;
                            </a>
                        </div>
                        <div className="flex-grow bg-white rounded-2xl overflow-hidden border border-gray-800 shadow-inner group">
                            <iframe
                                src={deploymentUrl}
                                title="Live Deployment"
                                className="w-full h-full border-0"
                                sandbox="allow-scripts allow-same-origin"
                            />
                        </div>
                    </div>
                ) : phase === 'analyzing_failure' && buildLogs ? (
                    <div className="h-full flex flex-col p-6 animate-in slide-in-from-bottom-4 duration-500">
                        <h3 className="text-lg font-black text-red-400 uppercase tracking-widest mb-4 flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                            Cycle Synchronization Failure
                        </h3>
                        <div className="bg-black/80 rounded-2xl p-6 flex-grow overflow-y-auto border border-red-900/30 custom-scrollbar-red">
                            <pre className="text-xs text-red-200/80 whitespace-pre-wrap font-mono leading-relaxed">
                                <code>{buildLogs}</code>
                            </pre>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col p-6">
                        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-4">
                            Live Stream Buffer: {currentFocusJob?.path || 'IDLE'}
                        </h3>
                        {currentFocusJob ? (
                             <div className="flex-grow flex flex-col min-h-0 bg-black/40 rounded-2xl border border-gray-800 overflow-hidden">
                                <div className="p-6 flex-grow font-mono overflow-y-auto custom-scrollbar-indigo">
                                    <pre className="text-[11px] text-indigo-100/90 whitespace-pre-wrap leading-relaxed animate-in fade-in duration-300">
                                        <code>{currentFocusJob.content || "Opening neural stream..."}</code>
                                    </pre>
                                </div>
                                {currentFocusJob.workers && (
                                    <div className="bg-gray-900/50 p-4 border-t border-gray-800">
                                        <div className="text-[9px] font-mono text-gray-600 mb-2 uppercase tracking-wide">Swarm Consensus Mapping:</div>
                                        <WorkerGrid workers={currentFocusJob.workers} />
                                    </div>
                                )}
                            </div>
                        ) : (
                             <div className="flex flex-col items-center justify-center h-full text-gray-700 gap-4">
                                <Spinner className="w-12 h-12 text-indigo-500/20" />
                                <p className="font-mono text-[10px] uppercase tracking-[0.5em] animate-pulse">Initializing neural collective...</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

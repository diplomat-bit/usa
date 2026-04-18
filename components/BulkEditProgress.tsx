import React from 'react';
import { BulkEditJob, AIWorkerStatus } from '../types';
import { Spinner } from './Spinner';

const StatusIcon: React.FC<{ status: BulkEditJob['status'] }> = ({ status }) => {
    switch (status) {
        case 'queued': 
            return <div title="Queued" className="w-4 h-4 rounded-full bg-gray-600 flex-shrink-0"></div>;
        case 'processing': 
            return <Spinner className="w-4 h-4 text-blue-400" />;
        case 'retrying':
            return <Spinner className="w-4 h-4 text-orange-400" />;
        case 'success': 
            return <div title="Success" className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">✓</div>;
        case 'skipped': 
            return <div title="Skipped" className="w-4 h-4 rounded-full bg-yellow-500 flex items-center justify-center text-black text-xs font-bold flex-shrink-0">-</div>;
        case 'failed': 
            return <div title="Failed" className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">!</div>;
        default: 
            return null;
    }
};

const WorkerGrid: React.FC<{ workers?: AIWorkerStatus[] }> = ({ workers }) => {
    if (!workers) return null;
    return (
        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-1 mt-2">
            {workers.map((w, i) => (
                <div 
                    key={i} 
                    title={`${w.model}: ${w.status}`}
                    className={`w-2 h-2 rounded-sm transition-all duration-300 ${
                        w.status === 'working' ? 'bg-blue-500 animate-pulse shadow-[0_0_5px_rgba(59,130,246,0.5)]' :
                        w.status === 'finished' ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]' :
                        w.status === 'failed' ? 'bg-red-500' :
                        'bg-gray-700'
                    }`}
                />
            ))}
        </div>
    );
};

interface BulkEditProgressProps {
  jobs: BulkEditJob[];
  onClose: () => void;
  isComplete: boolean;
}

export const BulkEditProgress: React.FC<BulkEditProgressProps> = ({ jobs, onClose, isComplete }) => {
  const completedCount = jobs.filter(j => j.status === 'success' || j.status === 'skipped' || j.status === 'failed').length;
  const successCount = jobs.filter(j => j.status === 'success').length;
  const progress = jobs.length > 0 ? (completedCount / jobs.length) * 100 : 0;
  
  const processingJobs = jobs.filter(j => j.status === 'processing' || j.status === 'retrying');

  return (
    <div className="fixed inset-0 bg-gray-950 bg-opacity-80 flex items-center justify-center z-50">
      <div className="bg-gray-850 p-6 rounded-lg shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col border border-gray-700">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
            <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold text-amber-400">AI Swarm Bulk Edit Progress</h2>
                <div className="flex items-center gap-2 bg-gray-900 px-3 py-1 rounded-full border border-gray-700">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                    <span className="text-xs font-mono text-gray-300 uppercase tracking-widest">Active Hybrid Swarm</span>
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
        
        <div className="mb-4 flex-shrink-0">
            <div className="flex justify-between text-sm text-gray-300 mb-1">
                <span className="font-mono">{`Overall Progress: ${completedCount} / ${jobs.length}`}</span>
                <span className="text-green-400">{successCount} successful commits</span>
            </div>
            <div className="w-full bg-gray-900 rounded-full h-1.5 overflow-hidden">
                <div 
                    className="bg-gradient-to-r from-amber-600 to-amber-400 h-full rounded-full transition-all duration-700 ease-out" 
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
        </div>

        <div className="grid grid-cols-12 gap-6 flex-grow min-h-0">
            <div className="col-span-3 bg-gray-900 rounded-lg p-4 overflow-y-auto border border-gray-800">
                 <h3 className="text-xs font-bold mb-3 text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-2">Target Sequence</h3>
                 <ul className="space-y-2">
                    {jobs.map(job => (
                        <li key={job.id} className={`flex flex-col gap-1 text-sm p-3 rounded-lg border transition-colors ${
                            job.status === 'processing' || job.status === 'retrying' ? 'bg-indigo-900/20 border-indigo-700/50' : 
                            job.status === 'success' ? 'bg-green-900/10 border-green-700/30' :
                            'bg-gray-850 border-gray-800'
                        }`}>
                           <div className="flex items-center justify-between">
                               <div className="flex items-center gap-3 overflow-hidden">
                                   <StatusIcon status={job.status} />
                                   <span className="truncate font-medium text-gray-200" title={job.path}>{job.path.split('/').pop()}</span>
                               </div>
                           </div>
                           <WorkerGrid workers={job.workers} />
                           {job.error && <p className="text-red-400 text-[10px] mt-1 break-words">{job.error}</p>}
                        </li>
                    ))}
                 </ul>
            </div>
            <div className="col-span-9 bg-gray-900 rounded-lg p-4 flex flex-col border border-gray-800">
                <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Active Neural Streams ({processingJobs.length})</h3>
                    <div className="flex gap-2 text-[10px] font-mono">
                        <span className="flex items-center gap-1 text-blue-400"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> ANALYZING</span>
                        <span className="flex items-center gap-1 text-green-400"><div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> SOLVED</span>
                    </div>
                </div>
                {processingJobs.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-grow min-h-0">
                       {processingJobs.slice(0, 6).map(job => (
                           <div key={job.id} className="flex flex-col min-h-0 bg-gray-850 rounded-xl overflow-hidden border border-gray-700/50 shadow-inner">
                               <div className="bg-gray-800 px-3 py-2 flex justify-between items-center border-b border-gray-700 shadow-sm">
                                   <p className="text-amber-400 font-mono text-[10px] truncate max-w-[70%]" title={job.path}>
                                     {job.path}
                                   </p>
                                   <div className="flex items-center gap-1">
                                       <span className="text-[10px] font-bold text-blue-400 animate-pulse uppercase tracking-tighter">SWARMING</span>
                                   </div>
                               </div>
                               <div className="p-3 bg-gray-950 flex-grow font-mono overflow-y-auto custom-scrollbar">
                                    <pre className="text-[10px] text-blue-100/80 whitespace-pre-wrap leading-relaxed">
                                        <code>{job.content || "Initializing neural consensus..."}</code>
                                    </pre>
                               </div>
                               {job.workers && (
                                   <div className="bg-gray-800/80 px-2 py-1 flex flex-wrap gap-1 border-t border-gray-700">
                                       <WorkerGrid workers={job.workers} />
                                   </div>
                               )}
                           </div>
                       ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-4">
                        <div className={`p-8 rounded-full bg-gray-850 border border-gray-800 ${isComplete ? 'text-green-500' : 'text-gray-700 opacity-50'}`}>
                            {isComplete ? <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 13l4 4L19 7" /></svg> : <svg className="w-12 h-12 animate-spin-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                        </div>
                        <p className="font-mono text-sm uppercase tracking-widest">
                            {isComplete ? "Swarm Operations Terminated. All nodes synchronized." : "Aggregating tasks for neural distribution..."}
                        </p>
                    </div>
                )}
            </div>
        </div>

      </div>
    </div>
  );
};

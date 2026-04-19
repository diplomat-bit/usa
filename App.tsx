import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AuthModal } from './components/AuthModal';
import { FileExplorer } from './components/FileExplorer';
import { EditorCanvas } from './components/EditorCanvas';
import { fetchAllRepos, fetchRepoTree, getFileContent, commitFile, getRepoBranches, createBranch, createPullRequest, createRepo, triggerWorkflow, getWorkflowRuns, getWorkflowRun, getWorkflowRunLogs } from './services/githubService';
import { primaryModels, fallbackModels, planRepositoryEdit, bulkEditFileWithAI, generateProjectPlan, generateFileContent, planProjectExpansionEdits, modelsToUse, streamSingleFileEdit, cleanAiCodeResponse, correctCodeFromBuildError, streamRepositoryFileEdit, setGeminiApiKey } from './services/geminiService';
import { GithubRepo, UnifiedFileTree, SelectedFile, Alert, Branch, FileNode, DirNode, BulkEditJob, ProjectGenerationJob, ProjectExpansionJob, ProjectExpansionPhase, ProjectPlan, AdvancedEditJob, AdvancedEditPhase, WorkflowRun, AdvancedEditJobStatus, RepositoryEditPlan, ProjectExpansionPlan } from './types';
import { Spinner } from './components/Spinner';
import { AlertPopup } from './components/AlertPopup';
import { MultiFileAiEditModal } from './components/BulkAiEditModal';
import { BulkEditProgress } from './components/BulkEditProgress';
import { NewProjectModal } from './components/NewProjectModal';
import { ProjectGenerationProgress } from './components/ProjectGenerationProgress';
import { ProjectExpansionModal } from './components/ProjectExpansionModal';
import { ProjectExpansionProgress } from './components/ProjectExpansionProgress';
import { AdvancedAiEditModal } from './components/AdvancedAiEditModal';
import { AdvancedEditProgress } from './components/AdvancedEditProgress';
import { AiChatModal } from './components/AiChatModal';
import { getAllFilePaths } from './utils';

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<UnifiedFileTree>({});
  
  const [openFiles, setOpenFiles] = useState<SelectedFile[]>([]);
  const [activeFileKey, setActiveFileKey] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [alert, setAlert] = useState<Alert | null>(null);
  
  const [branchesByRepo, setBranchesByRepo] = useState<Record<string, Branch[]>>({});
  const [currentBranchByRepo, setCurrentBranchByRepo] = useState<Record<string, string>>({});

  const [isMultiEditModalOpen, setMultiEditModalOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkEditJobs, setBulkEditJobs] = useState<BulkEditJob[]>([]);
  
  const [isNewProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const [isGeneratingProject, setIsGeneratingProject] = useState(false);
  const [projectGenerationJobs, setProjectGenerationJobs] = useState<ProjectGenerationJob[]>([]);
  const [projectGenerationStatus, setProjectGenerationStatus] = useState('');
  
  const [isExpansionModalOpen, setExpansionModalOpen] = useState(false);
  const [isExpandingProject, setIsExpandingProject] = useState(false);
  const [expansionJobs, setExpansionJobs] = useState<ProjectExpansionJob[]>([]);
  const [expansionPhase, setExpansionPhase] = useState<ProjectExpansionPhase>('idle');
  
  // State for the new Advanced AI Edit feature
  const [isAdvancedEditModalOpen, setAdvancedEditModalOpen] = useState(false);
  const [isAdvancedEditing, setIsAdvancedEditing] = useState(false);
  const [advancedEditJobs, setAdvancedEditJobs] = useState<AdvancedEditJob[]>([]);
  const [advancedEditPhase, setAdvancedEditPhase] = useState<AdvancedEditPhase>('idle');
  const [verificationAttempt, setVerificationAttempt] = useState(0);
  const [advancedEditBuildLogs, setAdvancedEditBuildLogs] = useState<string | null>(null);
  const [workflowRunUrl, setWorkflowRunUrl] = useState<string | null>(null);
  const [aiThought, setAiThought] = useState<string | null>(null);
  const [deploymentUrl, setDeploymentUrl] = useState<string | null>(null);
  const [lastInstruction, setLastInstruction] = useState<string>('');
  const [isSwarmModeActive, setIsSwarmModeActive] = useState(false);
  const swarmIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const openingFilesRef = useRef<Set<string>>(new Set());

  // State for simple AI Edit
  const [isAiChatModalOpen, setAiChatModalOpen] = useState(false);
  const modelLastUsedRef = useRef<Record<string, number>>({});
  const commitChainRef = useRef<Promise<any>>(Promise.resolve());

  const activeFile = openFiles.find(f => (f.repoFullName + '::' + f.path) === activeFileKey);
  const currentBranch = activeFile ? currentBranchByRepo[activeFile.repoFullName] : null;
  const branches = activeFile ? branchesByRepo[activeFile.repoFullName] || [] : [];

  const handleTokenSubmit = useCallback(async (credentials: { githubToken: string; geminiKey?: string }) => {
    if (!credentials.githubToken) return;
    
    if (credentials.geminiKey) {
        setGeminiApiKey(credentials.geminiKey);
    }

    setToken(credentials.githubToken);
    setIsLoading(true);
    setLoadingMessage('Fetching repositories...');
    try {
      const repos: GithubRepo[] = await fetchAllRepos(credentials.githubToken);
      const newFileTree: UnifiedFileTree = {};
      
      const repoPromises = repos.map(async (repo) => {
        setLoadingMessage(`Processing ${repo.owner.login}/${repo.name}...`);
        try {
          newFileTree[repo.full_name] = { repo, tree: [] };
          // Fetch default branch tree
           const tree = await fetchRepoTree(credentials.githubToken, repo.owner.login, repo.name, repo.default_branch);
           newFileTree[repo.full_name].tree = tree;

           // Also fetch branches
           const repoBranches = await getRepoBranches(credentials.githubToken, repo.owner.login, repo.name);
           setBranchesByRepo(prev => ({ ...prev, [repo.full_name]: repoBranches }));
           setCurrentBranchByRepo(prev => ({ ...prev, [repo.full_name]: repo.default_branch }));

        } catch (e: any) {
          if (e.message?.includes('409')) {
             newFileTree[repo.full_name].tree = [];
          } else {
             console.error(`Failed to fetch tree for ${repo.full_name}`, e);
          }
        }
      });

      await Promise.all(repoPromises);
      setFileTree(newFileTree);
    } catch (error) {
      console.error(error);
      setAlert({ type: 'error', message: 'Failed to load repositories. Check your token.' });
      setToken(null);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, []);

  const handleFileSelect = async (repoFullName: string, path: string) => {
    const fileKey = repoFullName + '::' + path;
    
    // 1. Sync check against current state
    if (openFiles.some(f => (f.repoFullName + '::' + f.path) === fileKey)) {
        setActiveFileKey(fileKey);
        return;
    }

    // 2. Race condition guard
    if (openingFilesRef.current.has(fileKey)) {
        return;
    }
    openingFilesRef.current.add(fileKey);

    if (!token) {
        openingFilesRef.current.delete(fileKey);
        return;
    }

    setIsLoading(true);
    setLoadingMessage(`Opening ${path}...`);
    try {
        // Find repo to get owner/name
        const repo = fileTree[repoFullName]?.repo;
        if (!repo) throw new Error("Repo not found");
        
        const branch = currentBranchByRepo[repoFullName] || repo.default_branch;

        const { content, sha } = await getFileContent(token, repo.owner.login, repo.name, path, branch);
        
        const newFile: SelectedFile = {
            repoFullName,
            path,
            content,
            editedContent: content,
            sha,
            defaultBranch: repo.default_branch
        };

        setOpenFiles(prev => {
            const exists = prev.some(f => (f.repoFullName + '::' + f.path) === fileKey);
            if (exists) return prev;
            return [...prev, newFile];
        });
        setActiveFileKey(fileKey);
    } catch (error) {
        console.error(error);
        setAlert({ type: 'error', message: `Failed to open file: ${path}` });
    } finally {
        openingFilesRef.current.delete(fileKey);
        setIsLoading(false);
        setLoadingMessage('');
    }
  };

  const handleCloseFile = (fileKey: string) => {
    setOpenFiles(prev => prev.filter(f => (f.repoFullName + '::' + f.path) !== fileKey));
    if (activeFileKey === fileKey) {
      setActiveFileKey(null);
    }
  };

  const handleFileContentChange = (fileKey: string, newContent: string) => {
    setOpenFiles(prev => prev.map(f => {
      if ((f.repoFullName + '::' + f.path) === fileKey) {
        return { ...f, editedContent: newContent };
      }
      return f;
    }));
  };

  const handleSetActiveFile = (fileKey: string) => {
    setActiveFileKey(fileKey);
  };

  const handleCommit = async (commitMessage: string) => {
    if (!activeFile || !token) return;
    setIsLoading(true);
    setLoadingMessage('Committing changes...');
    try {
        const [owner, repoName] = activeFile.repoFullName.split('/');
        const branch = currentBranchByRepo[activeFile.repoFullName] || activeFile.defaultBranch;

        const newSha = await commitFile({
            token,
            owner,
            repo: repoName,
            branch,
            path: activeFile.path,
            content: activeFile.editedContent,
            message: commitMessage,
            sha: activeFile.sha
        });

        // Update local state
        setOpenFiles(prev => prev.map(f => {
            if ((f.repoFullName + '::' + f.path) === activeFileKey) {
                return { ...f, content: f.editedContent, sha: newSha };
            }
            return f;
        }));
        
        setAlert({ type: 'success', message: 'Changes committed successfully!' });

    } catch (error) {
        console.error(error);
        setAlert({ type: 'error', message: 'Failed to commit changes.' });
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  };

  const handleBranchChange = async (newBranch: string) => {
      if (!activeFile || !token) return;
      const repoFullName = activeFile.repoFullName;
      setCurrentBranchByRepo(prev => ({ ...prev, [repoFullName]: newBranch }));
      
      // Reload active file content for the new branch
      setIsLoading(true);
      try {
          const [owner, repoName] = repoFullName.split('/');
          const { content, sha } = await getFileContent(token, owner, repoName, activeFile.path, newBranch);
           setOpenFiles(prev => prev.map(f => {
            if ((f.repoFullName + '::' + f.path) === activeFileKey) {
                return { ...f, content, editedContent: content, sha };
            }
            return f;
        }));
        // Also need to refresh file tree for the new branch
        const tree = await fetchRepoTree(token, owner, repoName, newBranch);
        setFileTree(prev => ({
            ...prev,
            [repoFullName]: { ...prev[repoFullName], tree }
        }));

      } catch (e) {
          console.error("Error switching branch", e);
          setAlert({ type: 'error', message: "Failed to switch branch/reload file."});
      } finally {
          setIsLoading(false);
      }
  };

  const handleCreateBranch = async (newBranchName: string) => {
      if (!activeFile || !token) return;
      setIsLoading(true);
      try {
          const [owner, repoName] = activeFile.repoFullName.split('/');
          const currentBranchName = currentBranchByRepo[activeFile.repoFullName] || activeFile.defaultBranch;
          
          // Get the SHA of the current branch head to base new branch off
          const branchData = await getRepoBranches(token, owner, repoName);
          const currentBranchData = branchData.find(b => b.name === currentBranchName);
          
          if (!currentBranchData) throw new Error("Could not find current branch tip SHA");

          await createBranch(token, owner, repoName, newBranchName, currentBranchData.commit.sha);
          
          // Refresh branches list
          const newBranches = await getRepoBranches(token, owner, repoName);
          setBranchesByRepo(prev => ({...prev, [activeFile.repoFullName]: newBranches}));
          
          // Switch to new branch
          handleBranchChange(newBranchName);
          setAlert({ type: 'success', message: `Branch ${newBranchName} created and active.`});

      } catch (e) {
          console.error(e);
          setAlert({ type: 'error', message: 'Failed to create branch.' });
      } finally {
          setIsLoading(false);
      }
  };

  const handleCreatePullRequest = async (title: string, body: string) => {
      if (!activeFile || !token) return;
      setIsLoading(true);
      try {
          const [owner, repoName] = activeFile.repoFullName.split('/');
          const head = currentBranchByRepo[activeFile.repoFullName];
          const base = activeFile.defaultBranch;
          
          const pr = await createPullRequest({
              token, owner, repo: repoName, title, body, head, base
          });
          setAlert({ type: 'success', message: `Pull Request #${pr.number} created: ${pr.html_url}` });
      } catch (e) {
           console.error(e);
           setAlert({ type: 'error', message: 'Failed to create Pull Request.' });
      } finally {
          setIsLoading(false);
      }
  };


  const toggleFileSelection = (fileKey: string, isSelected: boolean) => {
      const newSelection = new Set(selectedFiles);
      if (isSelected) {
          newSelection.add(fileKey);
      } else {
          newSelection.delete(fileKey);
      }
      setSelectedFiles(newSelection);
  };

  const toggleDirectorySelection = (nodes: (DirNode | FileNode)[], repoFullName: string, shouldSelect: boolean) => {
      const paths = getAllFilePaths(nodes);
      const newSelection = new Set(selectedFiles);
      paths.forEach(p => {
          const key = `${repoFullName}::${p}`;
          if (shouldSelect) newSelection.add(key);
          else newSelection.delete(key);
      });
      setSelectedFiles(newSelection);
  };

  // --- Bulk Edit Logic ---

  const handleStartBulkEdit = () => {
      if (selectedFiles.size === 0) return;
      setMultiEditModalOpen(true);
  };

  const handleBulkEditSubmit = async (instruction: string) => {
      setMultiEditModalOpen(false);
      setIsBulkEditing(true);
      
      const jobList: BulkEditJob[] = Array.from(selectedFiles).map((key: string) => {
          const [repoFullName, ...pathParts] = key.split('::');
          return {
              id: key,
              repoFullName,
              path: pathParts.join('::'), 
              status: 'queued',
              content: '',
              error: null,
              workers: [],
              attempts: 0
          };
      });
      setBulkEditJobs(jobList);

      const jobQueue = [...jobList];

      const processJob = async (job: BulkEditJob, model: string) => {
         if (!token) return;
         setBulkEditJobs(prev => prev.map(j => j.id === job.id ? { 
             ...j, 
             status: 'processing',
             workers: [{ model, status: 'working', content: '' }]
         } : j));
         
         const [owner, repo] = job.repoFullName.split('/');
         const { content: originalContent, sha } = await getFileContent(token, owner, repo, job.path, currentBranchByRepo[job.repoFullName]);
         
         let finalContent = '';
         await bulkEditFileWithAI(
             originalContent,
             instruction,
             job.path,
             (chunk) => {
                 finalContent += chunk;
                 setBulkEditJobs(prev => prev.map(j => j.id === job.id ? { 
                     ...j, 
                     content: finalContent,
                     workers: [{ model, status: 'working', content: finalContent }]
                 } : j));
             },
             () => finalContent,
             model
         );
         
         const cleanedContent = cleanAiCodeResponse(finalContent);
         
         await (commitChainRef.current = commitChainRef.current.then(async () => {
             // JIT fetch SHA inside the serial lock
             let currentSha = sha;
             try {
                 const f = await getFileContent(token, owner, repo, job.path, currentBranchByRepo[job.repoFullName]);
                 currentSha = f.sha;
             } catch (e) {}

             return commitFile({
                 token, owner, repo,
                 branch: currentBranchByRepo[job.repoFullName] || 'main',
                 path: job.path,
                 content: cleanedContent,
                 message: `AI Swarm Edit (${model}): ${instruction.slice(0, 50)}...`,
                 sha: currentSha
             });
         }));
         
         setBulkEditJobs(prev => prev.map(j => j.id === job.id ? { 
             ...j, 
             status: 'success',
             workers: [{ model, status: 'finished', content: finalContent }]
         } : j));
      };

      const startWorker = async (model: string) => {
          while (jobQueue.length > 0) {
              const job = jobQueue.shift();
              if (!job) break;

              // 30s Cooldown
              const now = Date.now();
              const lastUsed = modelLastUsedRef.current[model] || 0;
              const wait = Math.max(0, 30500 - (now - lastUsed));
              if (wait > 0) await new Promise(r => setTimeout(r, wait));
              modelLastUsedRef.current[model] = Date.now();

              try {
                  await processJob(job, model);
              } catch (e: any) {
                  console.error(`Model ${model} failed for ${job.path}`, e);
                  job.attempts = (job.attempts || 0) + 1;
                  
                  if (job.attempts < 3) {
                      setBulkEditJobs(prev => prev.map(j => j.id === job.id ? { 
                          ...j, 
                          status: 'retrying',
                          error: `Retrying (${job.attempts}/3)...` 
                      } : j));
                      jobQueue.push(job); // Put back in queue for another model
                  } else {
                      setBulkEditJobs(prev => prev.map(j => j.id === job.id ? { 
                          ...j, 
                          status: 'failed', 
                          error: e.message || 'Exhausted retries',
                          workers: [{ model, status: 'failed', content: '' }]
                      } : j));
                  }
              }
          }
      };

      // Start all workers
      primaryModels.forEach(model => startWorker(model));
  };

  // --- New Project Generation Logic ---
  
  const handleStartNewProject = () => {
      setNewProjectModalOpen(true);
  };

  const handleProjectGenerationSubmit = async (repoName: string, prompt: string, isPrivate: boolean) => {
      if (!token) return;
      setNewProjectModalOpen(false);
      setIsGeneratingProject(true);
      setProjectGenerationStatus('Initializing repository...');
      setProjectGenerationJobs([]);

      try {
          // 1. Create Repo
          const repo = await createRepo({ token, name: repoName, description: `AI Generated: ${prompt.slice(0, 50)}...`, isPrivate });
          setProjectGenerationStatus(`Repository ${repo.full_name} created. Planning structure...`);

          // Parallel Swarm Project Generation Planning
          const projectPlanSwarm = primaryModels.map(model => 
              generateProjectPlan(prompt, model)
          );
          const plan = await Promise.any(projectPlanSwarm);
          if (!plan) throw new Error("Failed to generate project plan.");

          const jobList: ProjectGenerationJob[] = plan.files.map((f, idx) => ({
              id: `${repoName}::${f.path}::${idx}`,
              path: f.path,
              description: f.description,
              status: 'queued',
              content: '',
              error: null,
              workers: [],
              attempts: 0
          }));
          setProjectGenerationJobs(jobList);
          setProjectGenerationStatus('Generating files...');

          const jobQueue = [...jobList];

          const processJob = async (job: ProjectGenerationJob, model: string) => {
                setProjectGenerationJobs(prev => prev.map(j => j.id === job.id ? { 
                    ...j, 
                    status: 'generating',
                    workers: [{ model, status: 'working', content: '' }]
                } : j));
                
                let agentContent = '';
                await generateFileContent(
                    prompt,
                    job.path,
                    job.description,
                    (chunk) => {
                        agentContent += chunk;
                        setProjectGenerationJobs(prev => prev.map(j => j.id === job.id ? { 
                            ...j, 
                            content: agentContent,
                            workers: [{ model, status: 'working', content: agentContent }]
                        } : j));
                    },
                    () => agentContent,
                    model
                );
                
                const cleanedContent = cleanAiCodeResponse(agentContent);
                setProjectGenerationJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'committing' } : j));
                
                await (commitChainRef.current = commitChainRef.current.then(async () => {
                    // JIT fetch SHA inside the serial lock
                    let currentSha: string | undefined = undefined;
                    try {
                        const f = await getFileContent(token, repo.owner.login, repo.name, job.path, repo.default_branch);
                        currentSha = f.sha;
                    } catch (e) {}

                    return commitFile({
                        token,
                        owner: repo.owner.login,
                        repo: repo.name,
                        branch: repo.default_branch,
                        path: job.path,
                        content: cleanedContent,
                        message: `AI Create Swarm (${model}): ${job.path}`,
                        sha: currentSha
                    });
                }));
                
                setProjectGenerationJobs(prev => prev.map(j => j.id === job.id ? { 
                    ...j, 
                    status: 'success',
                    workers: [{ model, status: 'finished', content: agentContent }]
                } : j));
           };

           const startWorker = async (model: string) => {
               while (jobQueue.length > 0) {
                   const job = jobQueue.shift();
                   if (!job) break;

                   const now = Date.now();
                   const lastUsed = modelLastUsedRef.current[model] || 0;
                   const wait = Math.max(0, 30500 - (now - lastUsed));
                   if (wait > 0) await new Promise(r => setTimeout(r, wait));
                   modelLastUsedRef.current[model] = Date.now();

                   try {
                       await processJob(job, model);
                   } catch (e: any) {
                       console.error(`Model ${model} failed for ${job.path}`, e);
                       job.attempts = (job.attempts || 0) + 1;
                       if (job.attempts < 3) {
                           setProjectGenerationJobs(prev => prev.map(j => j.id === job.id ? { 
                               ...j, 
                               status: 'retrying',
                               error: `Retrying (${job.attempts}/3)...`
                           } : j));
                           jobQueue.push(job);
                       } else {
                           setProjectGenerationJobs(prev => prev.map(j => j.id === job.id ? { 
                               ...j, 
                               status: 'failed', 
                               error: e.message || 'Worker failed',
                               workers: [{ model, status: 'failed', content: '' }]
                           } : j));
                       }
                   }
               }
           };

           primaryModels.forEach(model => startWorker(model));
            
            // Wait for all to finish (approximate check in UI)

            // Refresh Repo List
            const repos = await fetchAllRepos(token);
            // This part is a bit tricky since we need to update the file tree in the background
            // But the user might be watching the progress modal.
            // We'll leave the refresh manual or rely on the user reloading for now, 
            // or just add it to the tree if we want to be fancy.
      } catch (error: any) {
          setProjectGenerationStatus(`Error: ${error.message}`);
      }
  };

  // --- Project Expansion Logic ---
  
  const handleStartProjectExpansion = () => {
      setExpansionModalOpen(true);
  };

  const handleExpansionSubmit = async (prompt: string) => {
      setExpansionModalOpen(false);
      setIsExpandingProject(true);
      setExpansionPhase('planning');
      setExpansionJobs([]);

      if (!token || selectedFiles.size !== 1) {
          setAlert({ type: 'error', message: 'Please select exactly one seed file.' });
          setIsExpandingProject(false);
          return;
      }
      
      const seedFileKey = Array.from(selectedFiles)[0] as string;
      const [repoFullName, ...pathParts] = seedFileKey.split('::');
      const seedFilePath = pathParts.join('::');
      const [owner, repo] = repoFullName.split('/');
      
      try {
          const { content: seedContent } = await getFileContent(token, owner, repo, seedFilePath, currentBranchByRepo[repoFullName]);

          // Parallel Swarm Expansion Planning
          const expansionPlanSwarm = primaryModels.map(model => 
              planProjectExpansionEdits([{ path: seedFilePath, content: seedContent }], prompt, model)
          );
          const plan = await Promise.any(expansionPlanSwarm);
          if (!plan) throw new Error("Failed to plan expansion.");

          const jobList: ProjectExpansionJob[] = plan.filesToCreate.map((f, idx) => ({
              id: `${repoFullName}::${f.path}::${idx}`, // Unique ID even if paths repeat
              path: f.path,
              type: 'create',
              description: f.description,
              agentIndex: f.agentIndex,
              status: 'queued',
              content: '',
              error: null,
              workers: [],
              attempts: 0
          }));
          
          setExpansionJobs(jobList);
          setExpansionPhase('generating');

          const jobQueue = [...jobList];

          const processJob = async (job: ProjectExpansionJob, model: string) => {
                setExpansionJobs(prev => prev.map(j => j.id === job.id ? { 
                    ...j, 
                    status: 'generating',
                    workers: [{ model, status: 'working', content: '' }]
                } : j));
                
                let agentContent = '';
                await generateFileContent(
                    prompt,
                    job.path,
                    job.description,
                    (chunk) => {
                        agentContent += chunk;
                        setExpansionJobs(prev => prev.map(j => j.id === job.id ? { 
                            ...j, 
                            content: agentContent,
                            workers: [{ model, status: 'working', content: agentContent }]
                        } : j));
                    },
                    () => agentContent,
                    model
                );
                
                const cleanedContent = cleanAiCodeResponse(agentContent);
                setExpansionJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'committing' } : j));
                
                await (commitChainRef.current = commitChainRef.current.then(async () => {
                    // JIT fetch SHA inside the serial lock
                    let currentSha: string | undefined = undefined;
                    try {
                        const f = await getFileContent(token!, owner, repo, job.path, currentBranchByRepo[repoFullName] || 'main');
                        currentSha = f.sha;
                    } catch (e) {}

                    return commitFile({
                        token: token!,
                        owner,
                        repo,
                        branch: currentBranchByRepo[repoFullName] || 'main',
                        path: job.path,
                        content: cleanedContent,
                        message: `AI Expansion Swarm (${model}): ${job.path}`,
                        sha: currentSha
                    });
                }));
                
                setExpansionJobs(prev => prev.map(j => j.id === job.id ? { 
                    ...j, 
                    status: 'success',
                    workers: [{ model, status: 'finished', content: agentContent }]
                } : j));
           };

           const startWorker = async (model: string) => {
               while (jobQueue.length > 0) {
                   const job = jobQueue.shift();
                   if (!job) break;

                   const now = Date.now();
                   const lastUsed = modelLastUsedRef.current[model] || 0;
                   const wait = Math.max(0, 30500 - (now - lastUsed));
                   if (wait > 0) await new Promise(r => setTimeout(r, wait));
                   modelLastUsedRef.current[model] = Date.now();

                   try {
                       await processJob(job, model);
                   } catch (e: any) {
                       console.error(`Model ${model} failed for expansion ${job.path}`, e);
                       job.attempts = (job.attempts || 0) + 1;
                       if (job.attempts < 3) {
                           setExpansionJobs(prev => prev.map(j => j.id === job.id ? { 
                               ...j, 
                               status: 'retrying',
                               error: `Retrying (${job.attempts}/3)...`
                           } : j));
                           jobQueue.push(job);
                       } else {
                           setExpansionJobs(prev => prev.map(j => j.id === job.id ? { 
                               ...j, 
                               status: 'failed', 
                               error: e.message || 'Worker failed',
                               workers: [{ model, status: 'failed', content: '' }]
                           } : j));
                       }
                   }
               }
           };

           primaryModels.forEach(model => startWorker(model));

           const checkCompletion = setInterval(() => {
                const pending = jobQueue.length > 0 || jobList.some(j => j.status === 'queued' || j.status === 'generating' || j.status === 'committing' || j.status === 'retrying');
                if (!pending) {
                    setExpansionPhase('complete');
                    clearInterval(checkCompletion);
                }
            }, 1000);

      } catch (error: any) {
          console.error(error);
          setAlert({ type: 'error', message: `Expansion failed: ${error.message}` });
          setExpansionPhase('complete'); // Stop spinner
      }
  };

  // --- Advanced AI Edit (Agentic Loop) ---

  const handleStartAdvancedEdit = () => {
      setAdvancedEditModalOpen(true);
  };

  const handleAdvancedEditSubmit = async (instruction: string, workflowId: string) => {
      setLastInstruction(instruction);
      setAdvancedEditModalOpen(false);
      setIsAdvancedEditing(true);
      setAdvancedEditPhase('analyzing');
      setAdvancedEditJobs([]);
      setVerificationAttempt(1);
      setAdvancedEditBuildLogs(null);
      setWorkflowRunUrl(null);
      setAiThought(null);
      setDeploymentUrl(null);
      
      if (!token || !activeFile) return;

      const [owner, repo] = activeFile.repoFullName.split('/');
      const branch = currentBranchByRepo[activeFile.repoFullName] || activeFile.defaultBranch;
      
      const executeSwarm = async (currentInstruction: string) => {
          try {
              let currentFiles = await openFiles.map(f => ({ path: f.path, content: f.content, sha: f.sha }));
              let attempt = 1;
              const MAX_ATTEMPTS = 3;

              while (attempt <= MAX_ATTEMPTS) {
                  setVerificationAttempt(attempt);
                  
                  if (attempt === 1) setAdvancedEditPhase('planning');
                  else setAdvancedEditPhase('analyzing_failure');

                  // Parallel Swarm Advanced Edit Planning
                  const planningSwarm = primaryModels.map(model => 
                      attempt === 1 ? 
                      planRepositoryEdit(currentInstruction, activeFile.path, currentFiles, model) :
                      correctCodeFromBuildError(currentInstruction, currentFiles, [], advancedEditBuildLogs || '', model)
                  );
                  const plan = await Promise.any(planningSwarm);
                  
                  if (!plan) throw new Error("Failed to generate edit plan.");
                  setAiThought(plan.reasoning);

                  const jobs: AdvancedEditJob[] = plan.filesToEdit.map((f, idx) => ({
                      id: `${activeFile.repoFullName}::${f.path}::${idx}`,
                      path: f.path,
                      status: 'planning',
                      content: '',
                      error: null,
                      workers: primaryModels.map(m => ({ model: m, status: 'idle', content: '' }))
                  }));
                  setAdvancedEditJobs(jobs);
                  
                  setAdvancedEditPhase('editing');
                  
                  const queue = plan.filesToEdit.map(f => ({ ...f, attempts: 0 }));

                  const processEdit = async (fileEdit: { path: string, changes: string }, model: string) => {
                      const jobIndex = jobs.findIndex(j => j.path === fileEdit.path);
                      if (jobIndex === -1) return;
                      
                      setAdvancedEditJobs(prev => prev.map((j, i) => i === jobIndex ? { 
                          ...j, 
                          status: 'editing',
                          workers: [{ model, status: 'working', content: '' }]
                      } : j));
                      
                      let originalContent = currentFiles.find(f => f.path === fileEdit.path)?.content || '';
                      if (!originalContent) {
                          try {
                              const f = await getFileContent(token, owner, repo, fileEdit.path, branch);
                              originalContent = f.content;
                          } catch (e) { }
                      }

                      let agentContent = '';
                      await streamRepositoryFileEdit(originalContent, fileEdit.changes, fileEdit.path, (chunk) => {
                          agentContent += chunk;
                          setAdvancedEditJobs(prev => prev.map((j, i) => i === jobIndex ? { 
                              ...j, 
                              content: agentContent,
                              workers: [{ model, status: 'working', content: agentContent }]
                          } : j));
                      }, model);
                      
                      const cleanedContent = cleanAiCodeResponse(agentContent);
                      
                      setAdvancedEditPhase('committing');
                      setAdvancedEditJobs(prev => prev.map((j, i) => i === jobIndex ? { ...j, status: 'committing' } : j));

                      await (commitChainRef.current = commitChainRef.current.then(async () => {
                          // JIT fetch SHA inside the serial lock
                          let currentSha: string | undefined = undefined;
                          try {
                              const f = await getFileContent(token, owner, repo, fileEdit.path, branch);
                              currentSha = f.sha;
                          } catch (e) {}

                          return commitFile({
                              token, owner, repo, branch,
                              path: fileEdit.path,
                              content: cleanedContent,
                              message: `AI Swarm Edit (${model}) (Attempt ${attempt}): ${fileEdit.path}`,
                              sha: currentSha
                          });
                      }));

                      setAdvancedEditJobs(prev => prev.map((j, i) => i === jobIndex ? { 
                          ...j, 
                          status: 'success',
                          workers: [{ model, status: 'finished', content: agentContent }]
                      } : j));
                  };

                  const runWorker = async (model: string) => {
                      while (queue.length > 0) {
                          const item = queue.shift();
                          if (!item) break;

                          const now = Date.now();
                          const lastUsed = modelLastUsedRef.current[model] || 0;
                          const wait = Math.max(0, 30500 - (now - lastUsed));
                          if (wait > 0) await new Promise(r => setTimeout(r, wait));
                          modelLastUsedRef.current[model] = Date.now();

                          try {
                              await processEdit(item, model);
                          } catch (e: any) {
                              console.error(`Model ${model} failed for advanced edit ${item.path}`, e);
                              item.attempts = (item.attempts || 0) + 1;
                              if (item.attempts < 3) {
                                  setAdvancedEditJobs(prev => prev.map(j => j.id === item.path ? { 
                                      ...j, 
                                      status: 'planning', // reusable for retrying status
                                      error: `Retrying (${item.attempts}/3)...` 
                                  } : j));
                                  queue.push(item);
                              } else {
                                  setAdvancedEditJobs(prev => prev.map(j => j.id === item.path ? { 
                                      ...j, 
                                      status: 'failed',
                                      error: e.message || 'Worker failed',
                                      workers: [{ model, status: 'failed', content: '' }]
                                  } : j));
                              }
                          }
                      }
                  };

                  await Promise.all(primaryModels.map(model => runWorker(model)));
                  
                  // Ensure all jobs finished (either success or failed)
                  while (true) {
                      const pending = jobs.filter(j => j.status === 'planning' || j.status === 'editing' || j.status === 'committing').length;
                      if (pending === 0 && queue.length === 0) break;
                      await new Promise(r => setTimeout(r, 1000));
                  }

                  setAdvancedEditPhase('triggering_workflow');
                  await triggerWorkflow(token, owner, repo, workflowId, branch);
                  
                  setAdvancedEditPhase('waiting_for_workflow');
                  await new Promise(r => setTimeout(r, 5000));
                  
                  let run: WorkflowRun | null = null;
                  while (true) {
                      const runs = await getWorkflowRuns(token, owner, repo, workflowId, branch);
                      if (runs.workflow_runs.length > 0) {
                          run = runs.workflow_runs[0];
                          setWorkflowRunUrl(run.html_url);
                          if (run.status === 'completed') break;
                      }
                      await new Promise(r => setTimeout(r, 5000));
                  }

                  if (run && run.conclusion === 'success') {
                      setAdvancedEditPhase('complete');
                      setDeploymentUrl(`https://${owner}.github.io/${repo}/`); 
                      return true; 
                  } else {
                      setAdvancedEditPhase('analyzing_failure');
                      const logs = await getWorkflowRunLogs(token, owner, repo, run!.id);
                      setAdvancedEditBuildLogs(logs);
                      attempt++;
                  }
              }
              return false;
          } catch (e) {
              console.error(e);
              return false;
          }
      };

      const success = await executeSwarm(instruction);

      // Swarm mode logic
      if (isSwarmModeActive) {
          swarmIntervalRef.current = setTimeout(() => {
              handleAdvancedEditSubmit(instruction, workflowId);
          }, 30000);
      }
  };

  const toggleSwarmMode = () => {
      setIsSwarmModeActive(prev => {
          const next = !prev;
          if (!next && swarmIntervalRef.current) {
              clearTimeout(swarmIntervalRef.current);
          }
          return next;
      });
  };

  // --- Simple AI Edit ---
  const handleStartSimpleAiEdit = () => {
    setAiChatModalOpen(true);
  };
  
  const handleSimpleAiEditSubmit = async (instruction: string) => {
      setAiChatModalOpen(false);
      if (!activeFile || !token) return;
      
      const fileKey = activeFileKey!;
      // Optimistic update with "Processing..." or similar could go here, 
      // but we stream directly into the editor so it's visible.
      
      try {
          let finalContent = '';
          await streamSingleFileEdit(
              activeFile.editedContent, 
              instruction, 
              activeFile.path, 
              (chunk) => {
                  finalContent += chunk;
                  handleFileContentChange(fileKey, finalContent);
              },
              modelsToUse[0]
          );
           // Final cleanup
           handleFileContentChange(fileKey, cleanAiCodeResponse(finalContent));
      } catch (e) {
          console.error(e);
          setAlert({ type: 'error', message: "AI Edit failed."});
      }
  };


  if (!token) {
    return <AuthModal onSubmit={handleTokenSubmit} isLoading={isLoading} />;
  }

  return (
    <div className="flex h-screen bg-gray-950 text-gray-200 font-sans">
      <div className="w-80 border-r border-gray-700 flex flex-col">
        <FileExplorer 
            fileTree={fileTree} 
            onFileSelect={handleFileSelect} 
            onStartMultiEdit={handleStartBulkEdit}
            onStartNewProject={handleStartNewProject}
            onStartProjectExpansion={handleStartProjectExpansion}
            selectedFilePath={activeFile?.path}
            selectedRepo={activeFile?.repoFullName}
            selectedFiles={selectedFiles}
            onFileSelection={toggleFileSelection}
            onDirectorySelection={toggleDirectorySelection}
        />
      </div>
      <div className="flex-grow flex flex-col relative">
        <EditorCanvas
          openFiles={openFiles}
          activeFile={activeFile || null}
          onCommit={handleCommit}
          onAdvancedAiEdit={handleStartAdvancedEdit}
          onSimpleAiEditRequest={handleStartSimpleAiEdit}
          onFileContentChange={handleFileContentChange}
          onCloseFile={handleCloseFile}
          onSetActiveFile={handleSetActiveFile}
          isLoading={isLoading}
          branches={branches}
          currentBranch={currentBranch}
          onBranchChange={handleBranchChange}
          onCreateBranch={handleCreateBranch}
          onCreatePullRequest={handleCreatePullRequest}
          isSwarmModeActive={isSwarmModeActive}
          onToggleSwarmMode={toggleSwarmMode}
        />
        {isLoading && loadingMessage && (
            <div className="absolute inset-0 bg-gray-950 bg-opacity-50 flex items-center justify-center z-20">
                <div className="bg-gray-850 p-4 rounded-lg shadow-lg flex items-center gap-3 border border-gray-700">
                    <Spinner />
                    <span>{loadingMessage}</span>
                </div>
            </div>
        )}
      </div>

      <AlertPopup alert={alert} onClose={() => setAlert(null)} />
      
      {isMultiEditModalOpen && (
          <MultiFileAiEditModal 
            fileCount={selectedFiles.size} 
            onClose={() => setMultiEditModalOpen(false)} 
            onSubmit={handleBulkEditSubmit} 
          />
      )}
      
      {isBulkEditing && (
          <BulkEditProgress 
            jobs={bulkEditJobs} 
            onClose={() => setIsBulkEditing(false)} 
            isComplete={bulkEditJobs.every(j => j.status === 'success' || j.status === 'failed' || j.status === 'skipped')} 
          />
      )}
      
      {isNewProjectModalOpen && (
          <NewProjectModal onClose={() => setNewProjectModalOpen(false)} onSubmit={handleProjectGenerationSubmit} />
      )}
      
      {isGeneratingProject && (
          <ProjectGenerationProgress 
            jobs={projectGenerationJobs} 
            statusMessage={projectGenerationStatus}
            onClose={() => setIsGeneratingProject(false)}
            isComplete={projectGenerationJobs.length > 0 && projectGenerationJobs.every(j => ['success', 'failed'].includes(j.status))}
          />
      )}
      
      {isExpansionModalOpen && (
          <ProjectExpansionModal onClose={() => setExpansionModalOpen(false)} onSubmit={handleExpansionSubmit} />
      )}

      {isExpandingProject && (
          <ProjectExpansionProgress
            jobs={expansionJobs}
            phase={expansionPhase}
            onClose={() => setIsExpandingProject(false)}
            isComplete={expansionPhase === 'complete'}
          />
      )}
      
      {isAdvancedEditModalOpen && activeFile && (
          <AdvancedAiEditModal 
            onClose={() => setAdvancedEditModalOpen(false)} 
            onSubmit={handleAdvancedEditSubmit}
            token={token}
            repoFullName={activeFile.repoFullName}
          />
      )}
      
      {isAdvancedEditing && (
          <AdvancedEditProgress
            jobs={advancedEditJobs}
            phase={advancedEditPhase}
            verificationAttempt={verificationAttempt}
            buildLogs={advancedEditBuildLogs}
            workflowRunUrl={workflowRunUrl}
            aiThought={aiThought}
            deploymentUrl={deploymentUrl}
            onClose={() => setIsAdvancedEditing(false)}
            isComplete={advancedEditPhase === 'complete'}
          />
      )}

      {isAiChatModalOpen && (
        <AiChatModal onClose={() => setAiChatModalOpen(false)} onSubmit={handleSimpleAiEditSubmit} />
      )}

    </div>
  );
}
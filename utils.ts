import { DirNode, FileNode } from './types';

export const getAllFilePaths = (nodes: (DirNode | FileNode)[]): string[] => {
    let paths: string[] = [];
    for (const node of nodes) {
        if (node.type === 'file') {
            paths.push(node.path);
        } else if (node.type === 'dir') {
            paths = paths.concat(getAllFilePaths(node.children));
        }
    }
    return paths;
};

export const getRandomElements = <T>(array: T[], count: number): T[] => {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
};
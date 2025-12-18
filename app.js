import JSZip from 'jszip';
import { createIcons, icons } from 'lucide';
import { 
    parseProjectIdentifier, 
    fetchProjectMetadata,
    getAllProjectRevisions, 
    getAssets, 
    processAssets 
} from './websim-api.js';
import { 
    generateDevvitJson, 
    generatePackageJson, 
    generateServerIndex, 
    generateReadme 
} from './devvit-templates.js';

// Initialize Lucide icons
createIcons({ icons });

const elements = {
    projectInput: document.getElementById('projectInput'),
    fetchBtn: document.getElementById('fetchBtn'),
    versionSection: document.getElementById('versionSection'),
    versionSelect: document.getElementById('versionSelect'),
    convertBtn: document.getElementById('convertBtn'),
    statusLog: document.getElementById('statusLog'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    loadingText: document.getElementById('loadingText'),
    projectInfo: document.getElementById('projectInfo'),
};

let currentProject = null;
let currentRevisions = [];

function log(msg) {
    elements.statusLog.classList.remove('hidden');
    const entry = document.createElement('div');
    entry.textContent = `> ${msg}`;
    elements.statusLog.appendChild(entry);
    elements.statusLog.scrollTop = elements.statusLog.scrollHeight;
}

function showLoading(text) {
    elements.loadingText.textContent = text;
    elements.loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    elements.loadingOverlay.classList.add('hidden');
}

async function handleFetch() {
    const input = elements.projectInput.value.trim();
    if (!input) return;

    try {
        showLoading("Fetching project info...");
        log("Parsing project identifier...");
        const identifier = parseProjectIdentifier(input);
        
        log(`Loading project data for ${identifier.type}...`);
        const projectData = await fetchProjectMetadata(identifier);

        currentProject = projectData.project;
        log(`Project found: ${currentProject.title}`);

        showLoading("Fetching revisions...");
        const revisions = await getAllProjectRevisions(currentProject.id);
        currentRevisions = revisions;
        
        elements.versionSelect.innerHTML = '';
        revisions.forEach(rev => {
            const versionNum = rev.revision;
            const createdAt = rev.created_at ? new Date(rev.created_at).toLocaleString() : 'Unknown date';
            
            if (versionNum !== undefined && versionNum !== null) {
                const opt = document.createElement('option');
                opt.value = versionNum;
                opt.textContent = `Revision ${versionNum} (${createdAt})`;
                elements.versionSelect.appendChild(opt);
            }
        });

        if (elements.versionSelect.options.length > 0) {
            elements.versionSelect.selectedIndex = 0;
        }

        elements.projectInfo.textContent = `Title: ${currentProject.title} | Author: @${currentProject.created_by.username}`;
        elements.versionSection.classList.remove('hidden');
        log(`${revisions.length} revisions loaded.`);
    } catch (error) {
        log(`Error: ${error.message}`);
        alert(`Failed to fetch project: ${error.message}`);
    } finally {
        hideLoading();
    }
}

async function handleConvert() {
    if (!currentProject) return;
    const version = elements.versionSelect.value;
    
    if (!version || version === "undefined") {
        alert("Please select a valid revision first.");
        return;
    }
    
    try {
        showLoading("Downloading assets from WebSim...");
        log(`Fetching assets for version ${version}...`);
        const assetResponse = await getAssets(currentProject.id, version);
        const assets = assetResponse.assets;
        
        log(`Processing ${assets.length} assets...`);
        const fileMap = await processAssets(assets);
        
        showLoading("Building Devvit project ZIP...");
        log("Generating Devvit boilerplate...");
        
        const zip = new JSZip();
        const appName = currentProject.title || "websim-export";
        
        // 1. Create directory structure
        const webFolder = zip.folder("web");
        const srcFolder = zip.folder("src");
        const serverFolder = srcFolder.folder("server");
        
        // 2. Add WebSim assets to web/ folder
        Object.entries(fileMap).forEach(([path, data]) => {
            webFolder.file(path, data);
        });
        
        // 3. Add Devvit config files
        zip.file("devvit.json", generateDevvitJson(appName));
        zip.file("package.json", generatePackageJson(appName));
        zip.file("README.md", generateReadme(appName));
        serverFolder.file("index.js", generateServerIndex());
        
        log("Bundling ZIP file...");
        const content = await zip.generateAsync({ type: "blob" });
        
        log("Download starting...");
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${appName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-devvit.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        log("Project exported successfully!");
    } catch (error) {
        log(`Export Error: ${error.message}`);
        alert(`Failed to convert project: ${error.message}`);
    } finally {
        hideLoading();
    }
}

elements.fetchBtn.addEventListener('click', handleFetch);
elements.convertBtn.addEventListener('click', handleConvert);
elements.projectInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleFetch();
});


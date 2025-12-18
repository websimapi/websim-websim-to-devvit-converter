const API_BASE = '/api/v1';

async function makeRequest(endpoint, options = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
    }
    
    return response.json();
}

export function getProjectById(projectId) {
    return makeRequest(`/projects/${projectId}`);
}

export function getProjectBySlug(username, slug) {
    return makeRequest(`/users/${username}/slugs/${slug}`);
}

export function getProjectRevisions(projectId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return makeRequest(`/projects/${projectId}/revisions?${query}`);
}

export async function getAllProjectRevisions(projectId) {
    let allRevisions = [];
    let hasNextPage = true;
    let afterCursor = null;

    while (hasNextPage) {
        const params = { first: 100 };
        if (afterCursor) params.after = afterCursor;

        const response = await getProjectRevisions(projectId, params);
        if (response.revisions && response.revisions.data) {
            allRevisions = allRevisions.concat(response.revisions.data);
        }
        hasNextPage = response.revisions?.meta?.has_next_page || false;
        afterCursor = response.revisions?.meta?.end_cursor;
        if (!afterCursor) hasNextPage = false;
    }
    return allRevisions;
}

export function getAssets(projectId, version) {
    return makeRequest(`/projects/${projectId}/revisions/${version}/assets`);
}

export function parseProjectIdentifier(input) {
    if (!input) return null;
    try {
        const url = new URL(input.startsWith('http') ? input : `https://${input}`);
        const pathname = url.pathname;
        const projectMatch = pathname.match(/^\/p\/([a-z0-9_-]{20})/);
        if (projectMatch) return { type: 'id', value: projectMatch[1] };
        const slugMatch = pathname.match(/^\/(@[^/]+)\/([^/]+)/);
        if (slugMatch) return { type: 'slug', username: slugMatch[1].substring(1), slug: slugMatch[2] };
        const cMatch = pathname.match(/^\/c\/([a-z0-9_-]{20})/);
        if (cMatch) return { type: 'id', value: cMatch[1] };
    } catch (e) {}

    const atSlugMatch = input.match(/^@([^/]+)\/([^/]+)/);
    if (atSlugMatch) return { type: 'slug', username: atSlugMatch[1], slug: atSlugMatch[2] };

    if (/^[a-z0-9_-]{20}$/.test(input)) return { type: 'id', value: input };
    throw new Error(`Invalid project identifier: "${input}".`);
}

export async function processAssets(assetList) {
    const files = {};
    const encoder = new TextEncoder();
    if (!assetList || !Array.isArray(assetList)) return files;

    const promises = assetList.map(async (asset) => {
        if (!asset.path) return;
        const path = asset.path.replace(/^(\.|\/)+/, '');
        if (path.endsWith('/')) return;
        
        if (typeof asset.content === 'string') {
            files[path] = encoder.encode(asset.content);
        } else if (!asset.content && asset.url) {
            try {
                const res = await fetch(asset.url);
                const blob = await res.arrayBuffer();
                files[path] = new Uint8Array(blob);
            } catch (e) {
                console.warn(`Failed to fetch asset ${path}`, e);
                files[path] = new Uint8Array(0);
            }
        } else if (asset.content && typeof asset.content === 'object') {
            files[path] = encoder.encode(JSON.stringify(asset.content));
        } else {
            files[path] = new Uint8Array(0);
        }
    });

    await Promise.all(promises);
    return files;
}


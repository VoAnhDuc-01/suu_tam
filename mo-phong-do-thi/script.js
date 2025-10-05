const canvas = document.getElementById('graphCanvas');
const ctx = canvas.getContext('2d');

let graph = {
  nodes: [],
  edges: [],
  directed: false,
  multigraph: false,
};

let foundPath = [];

// Animation related variables
let animationState = {
  isRunning: false,
  isPaused: false,
  speed: 5,
  currentStep: 0,
  algorithmSteps: [],
  algorithm: null,
  timer: null,
  customStates: {}
};

// Animation control elements
const playBtn = document.getElementById('play-btn');
const pauseBtn = document.getElementById('pause-btn');
const stepBtn = document.getElementById('step-btn');
const resetBtn = document.getElementById('reset-btn');
const speedSlider = document.getElementById('speed-slider');

const manualInputRadio = document.getElementById('manualInput');
const fileInputRadio = document.getElementById('fileInput');
const manualInputSection = document.getElementById('manual-input-section');
const fileInputSection = document.getElementById('file-input-section');
const uploadFileButton = document.getElementById('uploadFileButton');
const fileInput = document.getElementById('graphFile');
const fileNameDisplay = document.getElementById('fileName');

manualInputRadio.addEventListener('change', toggleInputMethod);
fileInputRadio.addEventListener('change', toggleInputMethod);

uploadFileButton.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (file) {
    fileNameDisplay.textContent = `Đã chọn: ${file.name}`;
    processFile(file, false); // Thêm tham số để không vẽ ngay
  } else {
    fileNameDisplay.textContent = 'Chưa có file nào được chọn';
  }
});

// Animation control functions
function initializeAnimation(algorithm, params) {
  resetAnimation();
  generateAlgorithmSteps(algorithm, params);
  animationState.algorithm = algorithm;
  updateControlButtons();
}

function playAnimation() {
  if (!animationState.algorithmSteps.length) return;
  
  animationState.isRunning = true;
  animationState.isPaused = false;
  updateControlButtons();
  
  if (animationState.timer) clearInterval(animationState.timer);
  
  animationState.timer = setInterval(() => {
    if (animationState.currentStep < animationState.algorithmSteps.length) {
      executeStep();
    } else {
      pauseAnimation();
    }
  }, getStepDelay());
}

function pauseAnimation() {
  animationState.isRunning = false;
  animationState.isPaused = true;
  updateControlButtons();
  
  if (animationState.timer) {
    clearInterval(animationState.timer);
    animationState.timer = null;
  }
}

function stepAnimation() {
  if (!animationState.algorithmSteps.length) return;
  
  if (animationState.isRunning) {
    pauseAnimation();
  }
  
  if (animationState.currentStep < animationState.algorithmSteps.length) {
    executeStep();
  }
}

function resetAnimation() {
  animationState.isRunning = false;
  animationState.isPaused = false;
  animationState.currentStep = 0;
  animationState.algorithmSteps = [];
  animationState.customStates = {};
  foundPath = [];
  
  if (animationState.timer) {
    clearInterval(animationState.timer);
    animationState.timer = null;
  }
  
  updateControlButtons();
  drawGraph();
}

function executeStep() {
  const step = animationState.algorithmSteps[animationState.currentStep];
  if (step) {
    applyStep(step);
    animationState.currentStep++;
    
    // Update progress information
    const progressText = `Bước ${animationState.currentStep}/${animationState.algorithmSteps.length}`;
    document.getElementById('result').value = `${progressText}\n${step.description || ''}`;
    
    // Check if animation is complete
    if (animationState.currentStep >= animationState.algorithmSteps.length) {
      pauseAnimation();
    }
  }
}

function applyStep(step) {
  // Reset temporary visualization
  graph.nodes.forEach(node => {
    delete node.current;
    delete node.visited;
    delete node.inQueue;
  });
  
  graph.edges.forEach(edge => {
    delete edge.current;
  });
  
  // Apply the step effects
  if (step.visitedNodes) {
    step.visitedNodes.forEach(nodeId => {
      const node = graph.nodes.find(n => n.id === nodeId);
      if (node) node.visited = true;
    });
  }
  
  if (step.currentNode) {
    const node = graph.nodes.find(n => n.id === step.currentNode);
    if (node) node.current = true;
  }
  
  if (step.queueNodes) {
    step.queueNodes.forEach(nodeId => {
      const node = graph.nodes.find(n => n.id === nodeId);
      if (node) node.inQueue = true;
    });
  }
  
  if (step.currentEdge) {
    const edge = graph.edges.find(e => 
      e.from === step.currentEdge.from && e.to === step.currentEdge.to);
    if (edge) edge.current = true;
  }
  
  if (step.path) {
    foundPath = step.path.map(p => ({
      from: p.from,
      to: p.to
    }));
  }
  
  // Custom state data for specific algorithms
  if (step.customState) {
    Object.assign(animationState.customStates, step.customState);
  }
  
  // Redraw the graph with the current state
  drawGraph();
}

function updateControlButtons() {
  playBtn.disabled = animationState.isRunning || 
                    animationState.currentStep >= animationState.algorithmSteps.length;
  pauseBtn.disabled = !animationState.isRunning;
  stepBtn.disabled = animationState.currentStep >= animationState.algorithmSteps.length;
  resetBtn.disabled = !animationState.algorithmSteps.length;
}

function getStepDelay() {
  // Convert slider value (1-10) to delay in milliseconds (1000ms to 100ms)
  return 1100 - (animationState.speed * 100);
}

function toggleInputMethod() {
  if (manualInputRadio.checked) {
    manualInputSection.style.display = 'block';
    fileInputSection.style.display = 'none';
  } else if (fileInputRadio.checked) {
    manualInputSection.style.display = 'none';
    fileInputSection.style.display = 'block';
    fileNameDisplay.textContent = 'Chưa có file nào được chọn';
    fileInput.value = '';
  }
}

function displayGraphType() {
  let typeText = "Loại đồ thị: ";
  if (graph.multigraph) typeText += "Đa đồ thị ";
  else typeText += "Đồ thị đơn ";
  typeText += graph.directed ? "có hướng" : "vô hướng";
  document.getElementById('graphType').textContent = typeText;
}

function drawCurvedEdge(ctx, x1, y1, x2, y2, index, total) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const angle = Math.atan2(dy, dx);
  
  // Significantly increase the curve offset for better visual separation
  // For bidirectional edges (when total=2), use a much larger offset
  const baseOffset = total === 2 ? 80 : 40;
  const offset = baseOffset * (index - (total - 1) / 2);
  
  const cx = (x1 + x2) / 2 + offset * Math.cos(angle + Math.PI / 2);
  const cy = (y1 + y2) / 2 + offset * Math.sin(angle + Math.PI / 2);

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(cx, cy, x2, y2);
  ctx.stroke();

  if (graph.directed) {
    const t = 0.75;
    const arrowX = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2;
    const arrowY = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2;
    const tangentAngle = Math.atan2(
      2 * (1 - t) * (cy - y1) + 2 * t * (y2 - cy),
      2 * (1 - t) * (cx - x1) + 2 * t * (x2 - cx)
    );
    const headLength = 10;
    const adjustedArrowX = arrowX - 15 * Math.cos(tangentAngle);
    const adjustedArrowY = arrowY - 15 * Math.sin(tangentAngle);

    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(
      adjustedArrowX - headLength * Math.cos(tangentAngle - Math.PI / 6),
      adjustedArrowY - headLength * Math.sin(tangentAngle - Math.PI / 6)
    );
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(
      adjustedArrowX - headLength * Math.cos(tangentAngle + Math.PI / 6),
      adjustedArrowY - headLength * Math.sin(tangentAngle + Math.PI / 6)
    );
    ctx.stroke();
  }
  
  // Return the control point for label positioning
  return { cx, cy };
}

function drawGraph() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;

  graph.directed = document.getElementById('isDirected').checked;
  graph.multigraph = document.getElementById('isMultigraph').checked;

  const edgeGroups = {};
  const directedMultiEdgeGroups = {};

  // Group edges for rendering
  graph.edges.forEach((edge, index) => {
    let key;
    if (graph.multigraph) {
      key = `${edge.from}->${edge.to}-${index}`;
      if (graph.directed) {
        const multiKey = `${edge.from}-${edge.to}`;
        if (!directedMultiEdgeGroups[multiKey]) directedMultiEdgeGroups[multiKey] = [];
        directedMultiEdgeGroups[multiKey].push({ ...edge, index });
      }
    } else if (graph.directed) {
      // For directed graphs, always use the exact edge direction for the key
      key = `${edge.from}->${edge.to}-${index}`;
    } else {
      // For undirected graphs, still sort the nodes to group identical edges
      key = [edge.from, edge.to].sort().join('-');
    }
    if (!edgeGroups[key]) edgeGroups[key] = [];
    edgeGroups[key].push({ ...edge, index });
  });

  for (const key in edgeGroups) {
    const edges = edgeGroups[key];
    edges.forEach((edge, idx) => {
      const fromNode = graph.nodes.find(node => node.id === edge.from);
      const toNode = graph.nodes.find(node => node.id === edge.to);
      if (fromNode && toNode) {
        ctx.strokeStyle = edge.current ? '#ff9800' : '#555';
        ctx.lineWidth = edge.current ? 3 : 1.5;

        const midX = (fromNode.x + toNode.x) / 2;
        const midY = (fromNode.y + toNode.y) / 2;

        if (edge.from === edge.to) {
          // Self-loop
          drawLoop(ctx, fromNode.x, fromNode.y);
          ctx.fillStyle = '#333';
          ctx.font = '12px Arial';
          ctx.fillText(edge.weight, fromNode.x + 25, fromNode.y - 35);
        } else if (graph.multigraph && graph.directed) {
          // Multiple edges between the same nodes in a directed multigraph
          const multiKey = `${edge.from}-${edge.to}`;
          const multiEdges = directedMultiEdgeGroups[multiKey];
          const multiIdx = multiEdges.findIndex(e => e.index === edge.index);
          const { cx, cy } = drawCurvedEdge(ctx, fromNode.x, fromNode.y, toNode.x, toNode.y, multiIdx, multiEdges.length);
          
          // Position the weight label directly on the curve at the control point
          ctx.fillStyle = '#333';
          ctx.font = 'bold 12px Arial';
          
          // Add a small white background for better readability
          const textWidth = ctx.measureText(edge.weight).width;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.fillRect(cx - textWidth/2 - 2, cy - 8, textWidth + 4, 16);
          
          ctx.fillStyle = '#333';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(edge.weight, cx, cy);
        } else if (graph.multigraph) {
          // Multiple edges between the same nodes in an undirected multigraph
          const { cx, cy } = drawCurvedEdge(ctx, fromNode.x, fromNode.y, toNode.x, toNode.y, idx, edges.length);
          
          // Position the weight label directly on the curve at the control point
          ctx.fillStyle = '#333';
          ctx.font = 'bold 12px Arial';
          
          // Add a small white background for better readability
          const textWidth = ctx.measureText(edge.weight).width;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.fillRect(cx - textWidth/2 - 2, cy - 8, textWidth + 4, 16);
          
          ctx.fillStyle = '#333';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(edge.weight, cx, cy);
        } else if (graph.directed) {
          // For directed graphs, check if there's a reverse edge
          const hasReverseEdge = graph.edges.some(e => e.from === edge.to && e.to === edge.from);
          
          if (hasReverseEdge) {
            // For bidirectional edges, use curved lines
            // Curve in different directions based on the node IDs to ensure consistency
            const curveDirection = edge.from < edge.to ? 1 : -1;
            const { cx, cy } = drawCurvedEdge(ctx, fromNode.x, fromNode.y, toNode.x, toNode.y, curveDirection, 2);
            
            // Position the weight label directly on the curve at the control point
            ctx.fillStyle = '#333';
            ctx.font = 'bold 12px Arial';
            
            // Add a small white background for better readability
            const textWidth = ctx.measureText(edge.weight).width;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.fillRect(cx - textWidth/2 - 2, cy - 8, textWidth + 4, 16);
            
            ctx.fillStyle = '#333';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(edge.weight, cx, cy);
          } else {
            // For one-way edges, use straight arrows
            drawArrow(ctx, fromNode.x, fromNode.y, toNode.x, toNode.y, edge.from, edge.to);
            
            // For one-way edges, center the text above/below the line
            ctx.fillStyle = '#333';
            ctx.font = '12px Arial';
            ctx.fillText(edge.weight, midX, midY - 10);
          }
        } else {
          // Simple undirected edge
          ctx.beginPath();
          ctx.moveTo(fromNode.x, fromNode.y);
          ctx.lineTo(toNode.x, toNode.y);
          ctx.stroke();
          ctx.fillStyle = '#333';
          ctx.font = '12px Arial';
          ctx.fillText(edge.weight, midX, midY - 10);
        }
      }
    });
  }

  if (foundPath.length > 0) {
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 5;
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(255, 0, 0, 0.5)';
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    foundPath.forEach((edge, idx) => {
      const fromNode = graph.nodes.find(node => node.id === edge.from);
      const toNode = graph.nodes.find(node => node.id === edge.to);
      if (fromNode && toNode) {
        if (edge.from === edge.to) {
          // Self-loop
          drawLoop(ctx, fromNode.x, fromNode.y);
        } else if (graph.multigraph) {
          // Handle multigraph edges
          const edgesInSameDirection = graph.edges.filter(e => e.from === edge.from && e.to === edge.to);
          const edgeIndex = edgesInSameDirection.findIndex(e => e.index === edge.index);
          const totalEdges = edgesInSameDirection.length;
          const { cx, cy } = drawCurvedEdge(ctx, fromNode.x, fromNode.y, toNode.x, toNode.y, edgeIndex, totalEdges);
        } else if (graph.directed) {
          // For directed edges in the path, check if there's a bidirectional edge
          const hasReverseEdge = graph.edges.some(e => e.from === edge.to && e.to === edge.from);
          
          if (hasReverseEdge) {
            // Use curved lines for bidirectional edges
            const curveDirection = edge.from < edge.to ? 1 : -1;
            const { cx, cy } = drawCurvedEdge(ctx, fromNode.x, fromNode.y, toNode.x, toNode.y, curveDirection, 2);
          } else {
            // Use straight arrows for one-way edges
            drawArrow(ctx, fromNode.x, fromNode.y, toNode.x, toNode.y, edge.from, edge.to);
          }
        } else {
          // Draw simple undirected line
          ctx.beginPath();
          ctx.moveTo(fromNode.x, fromNode.y);
          ctx.lineTo(toNode.x, toNode.y);
          ctx.stroke();
        }
      }
    });

    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  // Draw nodes with their current state
  graph.nodes.forEach(node => {
    ctx.beginPath();
    ctx.arc(node.x, node.y, 15, 0, 2 * Math.PI);
    
    // Node fill color based on state
    if (node.current) {
      ctx.fillStyle = '#ff9800'; // Current node (orange)
    } else if (node.visited) {
      ctx.fillStyle = '#9c27b0'; // Visited node (purple)
    } else if (node.inQueue) {
      ctx.fillStyle = '#66BB6A'; // In queue node (default green)
      ctx.strokeStyle = '#2196F3'; // Blue border for queue nodes
      ctx.lineWidth = 2;
    } else {
      ctx.fillStyle = '#66BB6A'; // Default node color (green)
      ctx.strokeStyle = '#2E7D32'; // Default border
      ctx.lineWidth = 1;
    }
    
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 5;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 14px Arial';
    ctx.fillText(node.id, node.x, node.y);

    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    // Show additional information for algorithms like Dijkstra or Bellman-Ford
    if (animationState.customStates.distances && 
        animationState.customStates.distances[node.id] !== undefined) {
      const distance = animationState.customStates.distances[node.id];
      const displayValue = distance === Infinity ? '∞' : distance;
      
      ctx.fillStyle = '#333';
      ctx.font = '12px Arial';
      ctx.fillText(displayValue, node.x, node.y - 25);
    }
  });

  const hasNegativeWeight = graph.edges.some(edge => edge.weight < 0);
  const infoText = `Số nút: ${graph.nodes.length}\nSố cạnh: ${graph.edges.length}\nCó trọng số âm: ${hasNegativeWeight ? 'Có' : 'Không'}`;
  document.getElementById('graphInfo').textContent = infoText;
}

function processFile(file, drawImmediately = true) {
  graph.nodes = [];
  graph.edges = [];
  foundPath = [];
  const nodesSet = new Set();
  const fileExtension = file.name.split('.').pop().toLowerCase();

  if (fileExtension === 'txt' || fileExtension === 'csv') {
    const reader = new FileReader();
    reader.onload = function(e) {
      const text = e.target.result;
      const lines = text.split('\n').filter(line => line.trim() !== '');
      parseLines(lines, nodesSet);
      graph.directed = document.getElementById('isDirected').checked;
      graph.multigraph = document.getElementById('isMultigraph').checked;
      generateGraphFromNodes(nodesSet);
      displayGraphType();
      if (drawImmediately) {
        drawGraph();
      } else {
        displayResult('File đã được tải. Vui lòng kiểm tra cấu hình và nhấn "Vẽ Đồ Thị".');
      }
    };
    reader.readAsText(file);
  } else if (fileExtension === 'xlsx') {
    const reader = new FileReader();
    reader.onload = function(e) {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
      parseLines(rows.map(row => row.join(' ')), nodesSet);
      graph.directed = document.getElementById('isDirected').checked;
      graph.multigraph = document.getElementById('isMultigraph').checked;
      generateGraphFromNodes(nodesSet);
      displayGraphType();
      if (drawImmediately) {
        drawGraph();
      } else {
        displayResult('File đã được tải. Vui lòng kiểm tra cấu hình và nhấn "Vẽ Đồ Thị".');
      }
    };
    reader.readAsArrayBuffer(file);
  } else {
    displayResult('Định dạng file không được hỗ trợ! Chỉ hỗ trợ .txt, .csv, .xlsx');
  }
}
function parseLines(lines, nodesSet) {
  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].trim().split(/[\s,]+/);
    if (parts.length !== 3) {
      displayResult(`Lỗi: Dòng ${i + 1} không đúng định dạng: "${lines[i]}"`);
      return;
    }
    const [from, to, weight] = parts;
    const w = parseFloat(weight);
    if (isNaN(w)) {
      displayResult(`Lỗi: Trọng số ở dòng ${i + 1} không phải số: "${weight}"`);
      return;
    }
    nodesSet.add(from);
    nodesSet.add(to);
    graph.edges.push({ from, to, weight: w, id: `edge-${i}` });
  }
}

function parseManualInput() {
  graph.nodes = [];
  graph.edges = [];
  foundPath = [];
  const nodesSet = new Set();
  const graphData = document.getElementById('graphData').value.trim();
  const lines = graphData.split('\n').filter(line => line.trim() !== '');

  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].trim().split(/\s+/);
    if (parts.length !== 3) {
      displayResult(`Lỗi: Dòng ${i + 1} không đúng định dạng: "${lines[i]}"`);
      return false;
    }
    const [from, to, weight] = parts;
    const w = parseFloat(weight);
    if (isNaN(w)) {
      displayResult(`Lỗi: Trọng số ở dòng ${i + 1} không phải số: "${weight}"`);
      return false;
    }
    nodesSet.add(from);
    nodesSet.add(to);
    graph.edges.push({ from, to, weight: w, id: `edge-${i}` });
  }
  graph.directed = document.getElementById('isDirected').checked;
  graph.multigraph = document.getElementById('isMultigraph').checked;
  generateGraphFromNodes(nodesSet);
  displayGraphType();
  return true;
}

function generateGraphFromNodes(nodesSet) {
  const nodesArray = Array.from(nodesSet);
  const radius = Math.min(canvas.width, canvas.height) / 2 - 50;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  graph.nodes = nodesArray.map((id, index) => {
    const angle = (index / nodesArray.length) * 2 * Math.PI;
    return {
      id,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });
}

function drawArrow(ctx, fromX, fromY, toX, toY, fromNode, toNode) {
  const headLength = 10;
  const dx = toX - fromX;
  const dy = toY - fromY;
  const angle = Math.atan2(dy, dx);
  const offset = 15;

  // Calculate an offset for bidirectional edges
  // If this is part of a bidirectional pair, offset it slightly
  const hasBidirectionalEdge = graph.directed && 
      graph.edges.some(e => e.from === toNode && e.to === fromNode);
  
  // Calculate perpendicular offset
  let offsetX = 0;
  let offsetY = 0;
  
  if (hasBidirectionalEdge) {
    // Create a perpendicular offset for bidirectional edges
    // Use a larger offset (10px) to make the separation more visible
    offsetX = 10 * Math.sin(angle);
    offsetY = -10 * Math.cos(angle);
    
    // If current edge is from the "greater" node to the "lesser" node (alphabetically),
    // invert the offset to create separation
    if (fromNode > toNode) {
      offsetX = -offsetX;
      offsetY = -offsetY;
    }
  }
  
  // Apply the offset to the points
  const adjustedFromX = fromX + offsetX;
  const adjustedFromY = fromY + offsetY;
  const adjustedToX = toX - offset * Math.cos(angle) + offsetX;
  const adjustedToY = toY - offset * Math.sin(angle) + offsetY;

  ctx.beginPath();
  ctx.moveTo(adjustedFromX, adjustedFromY);
  ctx.lineTo(adjustedToX, adjustedToY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(adjustedToX, adjustedToY);
  ctx.lineTo(adjustedToX - headLength * Math.cos(angle - Math.PI / 6), adjustedToY - headLength * Math.sin(angle - Math.PI / 6));
  ctx.moveTo(adjustedToX, adjustedToY);
  ctx.lineTo(adjustedToX - headLength * Math.cos(angle + Math.PI / 6), adjustedToY - headLength * Math.sin(angle + Math.PI / 6));
  ctx.stroke();
}

function drawLoop(ctx, x, y) {
  ctx.beginPath();
  ctx.arc(x + 25, y - 25, 15, 0, 2 * Math.PI);
  ctx.stroke();
}

function displayResult(message) {
  document.getElementById('result').value = message;
}

function clearGraph() {
  graph.nodes = [];
  graph.edges = [];
  foundPath = [];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  displayResult('Đồ thị đã được xóa.');
  document.getElementById('graphInfo').textContent = 'Chưa có dữ liệu.';
  document.getElementById('graphType').textContent = 'Loại đồ thị: Chưa xác định';
}

function getNeighbors(node) {
  const neighbors = new Set();
  
  graph.edges.forEach(edge => {
    if (edge.from === node) {
      neighbors.add(edge.to);
    }
    if (!graph.directed && edge.to === node) {
      neighbors.add(edge.from);
    }
  });
  
  return Array.from(neighbors);
}

function dfsGeneral() {
  const visited = new Set();
  const traversalOrder = [];
  const edgesUsed = [];

  function dfs(node) {
    if (visited.has(node)) return;
    visited.add(node);
    traversalOrder.push(node);

    const neighbors = getNeighbors(node);
    for (let neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        edgesUsed.push({ from: node, to: neighbor });
        dfs(neighbor);
      }
    }
  }

  graph.nodes.forEach(node => {
    if (!visited.has(node.id)) {
      dfs(node.id);
    }
  });

  displayResult(`DFS (toàn đồ thị): ${traversalOrder.join(' -> ')}`);
  foundPath = edgesUsed;
  drawGraph();
}

function bfsGeneral() {
  const visited = new Set();
  const traversalOrder = [];
  const edgesUsed = [];

  function bfs(start) {
    const queue = [start];
    visited.add(start);

    while (queue.length > 0) {
      const node = queue.shift();
      traversalOrder.push(node);

      const neighbors = getNeighbors(node);
      for (let neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
          edgesUsed.push({ from: node, to: neighbor });
        }
      }
    }
  }

  graph.nodes.forEach(node => {
    if (!visited.has(node.id)) {
      bfs(node.id);
    }
  });

  displayResult(`BFS (toàn đồ thị): ${traversalOrder.join(' -> ')}`);
  foundPath = edgesUsed;
  drawGraph();
}

function dfs(start) {
  const visited = new Set();
  const path = [];
  const edgesUsed = [];

  function traverse(node) {
    if (visited.has(node)) return;
    visited.add(node);
    path.push(node);

    graph.edges
      .filter(edge => edge.from === node && (!graph.directed || edge.to !== node))
      .forEach(edge => {
        if (!visited.has(edge.to)) {
          edgesUsed.push({ from: node, to: edge.to });
          traverse(edge.to);
        }
      });
  }

  traverse(start);

  displayResult(`DFS Order: ${path.join(' -> ')}`);
  foundPath = edgesUsed;
  drawGraph();

  const unvisited = graph.nodes.filter(node => !visited.has(node.id));
  if (unvisited.length > 0) {
    displayResult(
      `DFS Order: ${path.join(' -> ')}\n` +
      `Lưu ý: Các nút ${unvisited.map(n => n.id).join(', ')} không được duyệt vì không liên thông với ${start}`
    );
  }
}

function bfs(start) {
  const queue = [start];
  const visited = new Set();
  const path = [];
  const edgesUsed = [];
  visited.add(start);
  path.push(start);

  while (queue.length) {
    const node = queue.shift();
    graph.edges
      .filter(edge => edge.from === node && (!graph.directed || edge.to !== node))
      .forEach(edge => {
        const nextNode = edge.to;
        if (!visited.has(nextNode)) {
          visited.add(nextNode);
          queue.push(nextNode);
          path.push(nextNode);
          edgesUsed.push({ from: node, to: nextNode });
        }
      });
  }

  displayResult(`BFS Order: ${path.join(' -> ')}`);
  foundPath = edgesUsed;
  drawGraph();

  const unvisited = graph.nodes.filter(node => !visited.has(node.id));
  if (unvisited.length > 0) {
    displayResult(
      `BFS Order: ${path.join(' -> ')}\n` +
      `Lưu ý: Các nút ${unvisited.map(n => n.id).join(', ')} không được duyệt vì không liên thông với ${start}`
    );
  }
}

function dijkstra(start, end) {
  const distances = {};
  const prev = {};
  const pq = new Set(graph.nodes.map(node => node.id));
  const edgesUsed = [];

  graph.nodes.forEach(node => distances[node.id] = Infinity);
  distances[start] = 0;

  while (pq.size) {
    let minNode = Array.from(pq).reduce((a, b) => (distances[a] < distances[b] ? a : b));
    pq.delete(minNode);

    if (minNode === end) {
      let path = [];
      let current = minNode;
      while (current) {
        path.push(current);
        if (prev[current]) {
          edgesUsed.push({ from: prev[current], to: current });
        }
        current = prev[current];
      }
      path.reverse();
      displayResult(`Dijkstra Path: ${path.join(' -> ')}\nTotal weight: ${distances[end]}`);
      foundPath = edgesUsed;
      drawGraph();
      return;
    }

    graph.edges
      .filter(edge => edge.from === minNode && (!graph.directed || edge.to !== minNode))
      .forEach(edge => {
        const neighbor = edge.to;
        if (pq.has(neighbor)) {
          const newDist = distances[minNode] + edge.weight;
          if (newDist < distances[neighbor]) {
            distances[neighbor] = newDist;
            prev[neighbor] = minNode;
          }
        }
      });
  }
  displayResult('Dijkstra: Không tìm thấy đường đi');
}

function kruskal() {
  if (graph.directed) {
    displayResult('Kruskal chỉ áp dụng cho đồ thị vô hướng!');
    return;
  }
  const parent = {};
  const rank = {};

  function find(node) {
    if (!parent[node]) parent[node] = node;
    if (parent[node] !== node) parent[node] = find(parent[node]);
    return parent[node];
  }

  function union(node1, node2) {
    const root1 = find(node1);
    const root2 = find(node2);
    if (root1 !== root2) {
      if (!rank[root1]) rank[root1] = 0;
      if (!rank[root2]) rank[root2] = 0;
      if (rank[root1] < rank[root2]) parent[root1] = root2;
      else if (rank[root1] > rank[root2]) parent[root2] = root1;
      else {
        parent[root2] = root1;
        rank[root1]++;
      }
    }
  }

  const sortedEdges = [...graph.edges].sort((a, b) => a.weight - b.weight);
  const mstEdges = [];
  let totalWeight = 0;

  sortedEdges.forEach(edge => {
    if (find(edge.from) !== find(edge.to)) {
      union(edge.from, edge.to);
      mstEdges.push(edge);
      totalWeight += edge.weight;
    }
  });

  foundPath = mstEdges.map(edge => ({ from: edge.from, to: edge.to }));
  displayResult(`Kruskal MST:\n${mstEdges.map(e => `${e.from} -> ${e.to} (${e.weight})`).join('\n')}\nTotal weight: ${totalWeight}`);
  drawGraph();
}

function prim() {
  if (graph.directed) {
    displayResult('Prim chỉ áp dụng cho đồ thị vô hướng!');
    return;
  }
  if (graph.nodes.length === 0) {
    displayResult('Đồ thị không có nút nào!');
    return;
  }

  const visited = new Set();
  const mstEdges = [];
  let totalWeight = 0;

  const startNode = graph.nodes[0].id;
  visited.add(startNode);

  const availableEdges = graph.multigraph
    ? [...graph.edges]
    : graph.edges.reduce((acc, edge) => {
        const key = [edge.from, edge.to].sort().join('-');
        if (!acc[key] || acc[key].weight > edge.weight) {
          acc[key] = edge;
        }
        return acc;
      }, {});

  const edgesList = graph.multigraph ? availableEdges : Object.values(availableEdges);

  while (visited.size < graph.nodes.length) {
    let minEdge = null;
    let minWeight = Infinity;

    edgesList.forEach(edge => {
      const fromIn = visited.has(edge.from);
      const toIn = visited.has(edge.to);
      if (fromIn !== toIn && edge.weight < minWeight) {
        minEdge = edge;
        minWeight = edge.weight;
      }
    });

    if (!minEdge) {
      const unvisited = graph.nodes.filter(node => !visited.has(node.id)).map(n => n.id);
      displayResult(
        `Prim MST:\n${mstEdges.map(e => `${e.from} -> ${e.to} (${e.weight})`).join('\n')}\n` +
        `Total weight: ${totalWeight}\n` +
        `Lưu ý: Đồ thị không liên thông, các nút chưa được thêm vào MST: ${unvisited.join(', ')}`
      );
      foundPath = mstEdges.map(edge => ({ from: edge.from, to: edge.to }));
      drawGraph();
      return;
    }

    mstEdges.push(minEdge);
    totalWeight += minEdge.weight;
    visited.add(minEdge.from);
    visited.add(minEdge.to);
  }

  foundPath = mstEdges.map(edge => ({ from: edge.from, to: edge.to }));
  displayResult(
    `Prim MST:\n${mstEdges.map(e => `${e.from} -> ${e.to} (${e.weight})`).join('\n')}\n` +
    `Total weight: ${totalWeight}`
  );
  drawGraph();
}

function bellmanFord(start) {
  const distances = {};
  const prev = {};
  const edgesUsed = [];

  graph.nodes.forEach(node => {
    distances[node.id] = Infinity;
    prev[node.id] = null;
  });
  distances[start] = 0;

  for (let i = 0; i < graph.nodes.length - 1; i++) {
    graph.edges.forEach(edge => {
      const u = edge.from;
      const v = edge.to;
      const w = edge.weight;
      if (distances[u] !== Infinity && distances[u] + w < distances[v]) {
        distances[v] = distances[u] + w;
        prev[v] = u;
      }
      if (!graph.directed && distances[v] !== Infinity && distances[v] + w < distances[u]) {
        distances[u] = distances[v] + w;
        prev[u] = v;
      }
    });
  }

  for (let edge of graph.edges) {
    const u = edge.from;
    const v = edge.to;
    const w = edge.weight;
    if (distances[u] !== Infinity && distances[u] + w < distances[v]) {
      displayResult('Bellman-Ford: Đồ thị chứa chu trình âm!');
      foundPath = [];
      return;
    }
    if (!graph.directed && distances[v] !== Infinity && distances[v] + w < distances[u]) {
      displayResult('Bellman-Ford: Đồ thị chứa chu trình âm!');
      foundPath = [];
      return;
    }
  }

  let result = 'Bellman-Ford Distances from ' + start + ':\n';
  graph.nodes.forEach(node => {
    if (distances[node.id] !== Infinity) {
      result += `${start} -> ${node.id}: ${distances[node.id]}\n`;
    } else {
      result += `${start} -> ${node.id}: Không có đường đi\n`;
    }
  });

  graph.nodes.forEach(node => {
    if (prev[node.id] !== null) {
      edgesUsed.push({ from: prev[node.id], to: node.id });
    }
  });

  displayResult(result);
  foundPath = edgesUsed;
  drawGraph();
}

function floyd() {
  const dist = {};
  const next = {};

  graph.nodes.forEach(u => {
    dist[u.id] = {};
    next[u.id] = {};
    graph.nodes.forEach(v => {
      dist[u.id][v.id] = u.id === v.id ? 0 : Infinity;
      next[u.id][v.id] = null;
    });
  });

  graph.edges.forEach(edge => {
    dist[edge.from][edge.to] = edge.weight;
    next[edge.from][edge.to] = edge.to;
    if (!graph.directed) {
      dist[edge.to][edge.from] = edge.weight;
      next[edge.to][edge.from] = edge.from;
    }
  });

  graph.nodes.forEach(k => {
    graph.nodes.forEach(i => {
      graph.nodes.forEach(j => {
        if (dist[i.id][k.id] + dist[k.id][j.id] < dist[i.id][j.id]) {
          dist[i.id][j.id] = dist[i.id][k.id] + dist[k.id][j.id];
          next[i.id][j.id] = next[i.id][k.id];
        }
      });
    });
  });

  const startNode = document.getElementById('startNode').value.trim();
  const endNode = document.getElementById('endNode').value.trim();

  if (!startNode || !endNode) {
    let result = 'Floyd-Warshall Distances:\n';
    graph.nodes.forEach(u => {
      graph.nodes.forEach(v => {
        if (dist[u.id][v.id] !== Infinity && u.id !== v.id) {
          result += `${u.id} -> ${v.id}: ${dist[u.id][v.id]}\n`;
        }
      });
    });
    displayResult(result);
    return;
  }

  if (dist[startNode][endNode] === Infinity) {
    displayResult('Floyd-Warshall: Không tìm thấy đường đi!');
    return;
  }

  let path = [startNode];
  const edgesUsed = [];
  while (path[path.length - 1] !== endNode) {
    const current = path[path.length - 1];
    const nextNode = next[current][endNode];
    path.push(nextNode);
    edgesUsed.push({ from: current, to: nextNode });
  }

  displayResult(`Floyd-Warshall Path: ${path.join(' -> ')}\nTotal weight: ${dist[startNode][endNode]}`);
  foundPath = edgesUsed;
  drawGraph();
}

function generateAlgorithmSteps(algorithm, params) {
  animationState.algorithmSteps = [];
  
  switch(algorithm) {
    case 'dfs':
      generateDFSSteps(params.startNode, params.endNode);
      break;
    case 'bfs':
      generateBFSSteps(params.startNode, params.endNode);
      break;
    case 'dfsGeneral':
      generateDFSGeneralSteps();
      break;
    case 'bfsGeneral':
      generateBFSGeneralSteps();
      break;
    case 'dijkstra':
      generateDijkstraSteps(params.startNode, params.endNode);
      break;
    case 'kruskal':
      generateKruskalSteps();
      break;
    case 'prim':
      generatePrimSteps();
      break;
    case 'bellmanFord':
      generateBellmanFordSteps(params.startNode);
      break;
    case 'floyd':
      generateFloydSteps(params.startNode, params.endNode);
      break;
    default:
      animationState.algorithmSteps = [];
  }
}

function generateDFSSteps(startNode, endNode = null) {
  const visited = new Set();
  const path = [];
  const stack = [startNode];
  const edges = [];
  const steps = [];
  let targetFound = false;
  
  // Initial step
  steps.push({
    description: endNode ? `Bắt đầu DFS từ nút ${startNode} tìm đường đến nút ${endNode}` : `Bắt đầu DFS từ nút ${startNode}`,
    currentNode: startNode,
    visitedNodes: Array.from(visited),
    queueNodes: Array.from(stack)
  });
  
  while (stack.length > 0 && !targetFound) {
    const node = stack.pop();
    
    if (visited.has(node)) continue;
    
    visited.add(node);
    path.push(node);
    
    // Check if we found the target node
    if (endNode && node === endNode) {
      targetFound = true;
      steps.push({
        description: `Đã tìm thấy nút đích ${endNode}!`,
        currentNode: node,
        visitedNodes: Array.from(visited),
        queueNodes: Array.from(stack),
        path: [...edges]
      });
      break;
    }
    
    steps.push({
      description: `Đang thăm nút ${node}`,
      currentNode: node,
      visitedNodes: Array.from(visited),
      queueNodes: Array.from(stack),
      path: [...edges]
    });
    
    const neighbors = getNeighbors(node).filter(n => !visited.has(n));
    
    // If no unvisited neighbors, backtrack step
    if (neighbors.length === 0 && stack.length > 0) {
      steps.push({
        description: `Không còn nút liền kề chưa thăm của ${node}, quay lui`,
        visitedNodes: Array.from(visited),
        queueNodes: Array.from(stack),
        path: [...edges]
      });
    }
    
    // Push neighbors in reverse order so we pop them in the right order
    for (let i = neighbors.length - 1; i >= 0; i--) {
      const neighbor = neighbors[i];
      stack.push(neighbor);
      
      // Add step showing edge being considered
      const currentEdge = { from: node, to: neighbor };
      edges.push(currentEdge);
      
      steps.push({
        description: `Thêm cạnh ${node} -> ${neighbor} vào đường đi và nút ${neighbor} vào stack`,
        currentEdge: currentEdge,
        currentNode: node,
        visitedNodes: Array.from(visited),
        queueNodes: Array.from(stack),
        path: [...edges]
      });
    }
  }
  
  if (targetFound) {
    // Reconstruct the path to the target node
    const finalPath = [];
    let current = endNode;
    const pathMap = {};
    
    // Create a map from the edges
    for (const edge of edges) {
      if (!pathMap[edge.to]) {
        pathMap[edge.to] = edge.from;
      }
    }
    
    // Reconstruct the path
    while (current && current !== startNode) {
      finalPath.unshift(current);
      current = pathMap[current];
    }
    finalPath.unshift(startNode);
    
    // Create final edges
    const finalEdges = [];
    for (let i = 0; i < finalPath.length - 1; i++) {
      finalEdges.push({ from: finalPath[i], to: finalPath[i+1] });
    }
    
    steps.push({
      description: `DFS kết thúc. Đường đi từ ${startNode} đến ${endNode}: ${finalPath.join(' -> ')}`,
      visitedNodes: Array.from(visited),
      path: finalEdges
    });
  } else {
    const unvisited = graph.nodes.filter(node => !visited.has(node.id)).map(n => n.id);
    let finalDescription = `DFS kết thúc. Thứ tự duyệt: ${path.join(' -> ')}`;
    
    if (endNode) {
      finalDescription = `DFS kết thúc. Không tìm thấy đường đi từ ${startNode} đến ${endNode}.`;
    } else if (unvisited.length > 0) {
      finalDescription += `\nLưu ý: Các nút ${unvisited.join(', ')} không được duyệt vì không liên thông với ${startNode}`;
    }
    
    steps.push({
      description: finalDescription,
      visitedNodes: Array.from(visited),
      path: edges
    });
  }
  
  animationState.algorithmSteps = steps;
}

function generateBFSSteps(startNode, endNode = null) {
  const visited = new Set();
  const path = [];
  const queue = [startNode];
  const edges = [];
  const steps = [];
  const parent = {}; // To track the parent of each node for path reconstruction
  let targetFound = false;
  
  visited.add(startNode);
  path.push(startNode);
  
  // Initial step
  steps.push({
    description: endNode ? `Bắt đầu BFS từ nút ${startNode} tìm đường đến nút ${endNode}` : `Bắt đầu BFS từ nút ${startNode}`,
    currentNode: startNode,
    visitedNodes: Array.from(visited),
    queueNodes: Array.from(queue)
  });
  
  while (queue.length > 0 && !targetFound) {
    const node = queue.shift();
    
    // Check if we found the target node
    if (endNode && node === endNode) {
      targetFound = true;
      steps.push({
        description: `Đã tìm thấy nút đích ${endNode}!`,
        currentNode: node,
        visitedNodes: Array.from(visited),
        queueNodes: Array.from(queue),
        path: [...edges]
      });
      break;
    }
    
    steps.push({
      description: `Đang xử lý nút ${node} từ hàng đợi`,
      currentNode: node,
      visitedNodes: Array.from(visited),
      queueNodes: Array.from(queue),
      path: [...edges]
    });
    
    const neighbors = getNeighbors(node);
    
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
        path.push(neighbor);
        parent[neighbor] = node; // Track the parent
        
        const currentEdge = { from: node, to: neighbor };
        edges.push(currentEdge);
        
        steps.push({
          description: `Thêm cạnh ${node} -> ${neighbor} vào đường đi và nút ${neighbor} vào hàng đợi`,
          currentEdge: currentEdge,
          currentNode: node,
          visitedNodes: Array.from(visited),
          queueNodes: Array.from(queue),
          path: [...edges]
        });
      }
    }
    
    if (queue.length > 0) {
      steps.push({
        description: `Đã xử lý tất cả các nút liền kề của ${node}, tiếp tục với nút tiếp theo trong hàng đợi`,
        visitedNodes: Array.from(visited),
        queueNodes: Array.from(queue),
        path: [...edges]
      });
    }
  }
  
  if (targetFound) {
    // Reconstruct the path to the target node
    const finalPath = [];
    let current = endNode;
    
    while (current) {
      finalPath.unshift(current);
      current = parent[current];
    }
    
    // Create final edges for the shortest path
    const finalEdges = [];
    for (let i = 0; i < finalPath.length - 1; i++) {
      finalEdges.push({ from: finalPath[i], to: finalPath[i+1] });
    }
    
    steps.push({
      description: `BFS kết thúc. Đường đi từ ${startNode} đến ${endNode}: ${finalPath.join(' -> ')}`,
      visitedNodes: Array.from(visited),
      path: finalEdges
    });
  } else {
    const unvisited = graph.nodes.filter(node => !visited.has(node.id)).map(n => n.id);
    let finalDescription = `BFS kết thúc. Thứ tự duyệt: ${path.join(' -> ')}`;
    
    if (endNode) {
      finalDescription = `BFS kết thúc. Không tìm thấy đường đi từ ${startNode} đến ${endNode}.`;
    } else if (unvisited.length > 0) {
      finalDescription += `\nLưu ý: Các nút ${unvisited.join(', ')} không được duyệt vì không liên thông với ${startNode}`;
    }
    
    steps.push({
      description: finalDescription,
      visitedNodes: Array.from(visited),
      path: edges
    });
  }
  
  animationState.algorithmSteps = steps;
}

function generateDijkstraSteps(startNode, endNode) {
  const distances = {};
  const prev = {};
  const visited = new Set();
  const steps = [];
  const edges = [];
  
  // Initialize distances
  graph.nodes.forEach(node => {
    distances[node.id] = Infinity;
    prev[node.id] = null;
  });
  distances[startNode] = 0;
  
  steps.push({
    description: `Khởi tạo Dijkstra từ nút ${startNode}. Khoảng cách từ ${startNode} đến ${startNode} = 0, các nút khác = ∞`,
    currentNode: startNode,
    customState: { distances: { ...distances }, prev: { ...prev } }
  });
  
  // Main Dijkstra algorithm
  let endNodeFound = false;
  while (visited.size < graph.nodes.length && !endNodeFound) {
    // Find the node with minimum distance
    let minDist = Infinity;
    let minNode = null;
    
    for (const node of graph.nodes) {
      if (!visited.has(node.id) && distances[node.id] < minDist) {
        minDist = distances[node.id];
        minNode = node.id;
      }
    }
    
    // No reachable nodes left
    if (minNode === null || distances[minNode] === Infinity) {
      break;
    }
    
    visited.add(minNode);
    
    steps.push({
      description: `Chọn nút ${minNode} có khoảng cách nhỏ nhất ${minDist}`,
      currentNode: minNode,
      visitedNodes: Array.from(visited),
      customState: { distances: { ...distances }, prev: { ...prev } },
      path: [...edges]
    });
    
    // If we reach the end node, we're done
    if (minNode === endNode) {
      endNodeFound = true;
      break;
    }
    
    // Update distances to neighbors
    const neighbors = graph.edges
      .filter(edge => edge.from === minNode)
      .map(edge => ({ id: edge.to, weight: edge.weight }));
    
    for (const { id: neighbor, weight } of neighbors) {
      if (visited.has(neighbor)) continue;
      
      const newDist = distances[minNode] + weight;
      
      steps.push({
        description: `Kiểm tra nút liền kề ${neighbor}. Khoảng cách hiện tại = ${distances[neighbor] === Infinity ? '∞' : distances[neighbor]}, khoảng cách mới qua ${minNode} = ${newDist}`,
        currentNode: minNode,
        currentEdge: { from: minNode, to: neighbor },
        visitedNodes: Array.from(visited),
        customState: { distances: { ...distances }, prev: { ...prev } },
        path: [...edges]
      });
      
      if (newDist < distances[neighbor]) {
        distances[neighbor] = newDist;
        prev[neighbor] = minNode;
        
        // If this edge is better, add it to our path (replacing any existing one)
        // First remove existing edge to this node if any
        const existingEdgeIndex = edges.findIndex(e => e.to === neighbor);
        if (existingEdgeIndex !== -1) {
          edges.splice(existingEdgeIndex, 1);
        }
        
        edges.push({ from: minNode, to: neighbor });
        
        steps.push({
          description: `Cập nhật khoảng cách đến ${neighbor} = ${newDist} và đặt prev[${neighbor}] = ${minNode}`,
          currentNode: minNode,
          currentEdge: { from: minNode, to: neighbor },
          visitedNodes: Array.from(visited),
          customState: { distances: { ...distances }, prev: { ...prev } },
          path: [...edges]
        });
      } else {
        steps.push({
          description: `Không cập nhật khoảng cách đến ${neighbor} vì ${newDist} ≥ ${distances[neighbor] === Infinity ? '∞' : distances[neighbor]}`,
          currentNode: minNode,
          visitedNodes: Array.from(visited),
          customState: { distances: { ...distances }, prev: { ...prev } },
          path: [...edges]
        });
      }
    }
  }
  
  // Reconstruct final path
  if (prev[endNode] !== null || startNode === endNode) {
    const finalPath = [];
    let current = endNode;
    
    while (current !== null) {
      finalPath.unshift(current);
      current = prev[current];
    }
    
    // Update path edges to show only the final path
    const finalEdges = [];
    for (let i = 0; i < finalPath.length - 1; i++) {
      finalEdges.push({ from: finalPath[i], to: finalPath[i+1] });
    }
    
    if (finalPath.length > 1) {
      steps.push({
        description: `Tìm thấy đường đi ngắn nhất: ${finalPath.join(' -> ')} với tổng trọng số = ${distances[endNode]}`,
        visitedNodes: Array.from(visited),
        customState: { distances: { ...distances }, prev: { ...prev } },
        path: finalEdges
      });
    } else {
      steps.push({
        description: `Không tìm thấy đường đi từ ${startNode} đến ${endNode}`,
        visitedNodes: Array.from(visited),
        customState: { distances: { ...distances }, prev: { ...prev } }
      });
    }
  } else {
    steps.push({
      description: `Không tìm thấy đường đi từ ${startNode} đến ${endNode}`,
      visitedNodes: Array.from(visited),
      customState: { distances: { ...distances }, prev: { ...prev } }
    });
  }
  
  animationState.algorithmSteps = steps;
}

// Placeholder implementations for other algorithms
function generateDFSGeneralSteps() {
  const steps = [];
  const visited = new Set();
  const edges = [];
  const stack = [];
  
  function dfs(node) {
    stack.push(node);
    visited.add(node);
    
    steps.push({
      description: `Bắt đầu thăm nút ${node}`,
      currentNode: node,
      visitedNodes: Array.from(visited),
      queueNodes: Array.from(stack),
      path: [...edges]
    });
    
    const neighbors = getNeighbors(node).filter(n => !visited.has(n));
    
    for (let neighbor of neighbors) {
      const currentEdge = { from: node, to: neighbor };
      edges.push(currentEdge);
      
      steps.push({
        description: `Thêm cạnh ${node} -> ${neighbor} vào đường đi`,
        currentEdge: currentEdge,
        currentNode: node,
        visitedNodes: Array.from(visited),
        queueNodes: Array.from(stack),
        path: [...edges]
      });
      
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      }
    }
    
    stack.pop();
    
    steps.push({
      description: `Hoàn thành thăm nút ${node}`,
      visitedNodes: Array.from(visited),
      queueNodes: Array.from(stack),
      path: [...edges]
    });
  }
  
  steps.push({
    description: "Bắt đầu DFS trên toàn đồ thị",
    visitedNodes: [],
    queueNodes: [],
    path: []
  });
  
  graph.nodes.forEach(node => {
    if (!visited.has(node.id)) {
      steps.push({
        description: `Khám phá thành phần liên thông mới từ nút ${node.id}`,
        currentNode: node.id,
        visitedNodes: Array.from(visited),
        queueNodes: Array.from(stack),
        path: [...edges]
      });
      dfs(node.id);
    }
  });
  
  steps.push({
    description: `DFS toàn đồ thị hoàn tất. Tổng số nút được thăm: ${visited.size}`,
    visitedNodes: Array.from(visited),
    path: [...edges]
  });
  
  animationState.algorithmSteps = steps;
}

function generateBFSGeneralSteps() {
  const steps = [];
  const visited = new Set();
  const queue = [];
  const edges = [];
  const parent = {};
  
  function bfs(startNode) {
    queue.push(startNode);
    visited.add(startNode);
    
    steps.push({
      description: `Bắt đầu BFS từ nút ${startNode}`,
      currentNode: startNode,
      visitedNodes: Array.from(visited),
      queueNodes: Array.from(queue),
      path: [...edges]
    });
    
    while (queue.length > 0) {
      const node = queue.shift();
      
      steps.push({
        description: `Xử lý nút ${node} từ hàng đợi`,
        currentNode: node,
        visitedNodes: Array.from(visited),
        queueNodes: Array.from(queue),
        path: [...edges]
      });
      
      const neighbors = getNeighbors(node);
      
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
          parent[neighbor] = node;
          
          const currentEdge = { from: node, to: neighbor };
          edges.push(currentEdge);
          
          steps.push({
            description: `Thêm cạnh ${node} -> ${neighbor} vào đường đi và nút ${neighbor} vào hàng đợi`,
            currentEdge: currentEdge,
            currentNode: node,
            visitedNodes: Array.from(visited),
            queueNodes: Array.from(queue),
            path: [...edges]
          });
        }
      }
      
      if (queue.length > 0) {
        steps.push({
          description: `Hoàn thành xử lý nút ${node}, tiếp tục với nút tiếp theo`,
          visitedNodes: Array.from(visited),
          queueNodes: Array.from(queue),
          path: [...edges]
        });
      }
    }
  }
  
  steps.push({
    description: "Bắt đầu BFS trên toàn đồ thị",
    visitedNodes: [],
    queueNodes: [],
    path: []
  });
  
  graph.nodes.forEach(node => {
    if (!visited.has(node.id)) {
      steps.push({
        description: `Khám phá thành phần liên thông mới từ nút ${node.id}`,
        currentNode: node.id,
        visitedNodes: Array.from(visited),
        queueNodes: Array.from(queue),
        path: [...edges]
      });
      bfs(node.id);
    }
  });
  
  steps.push({
    description: `BFS toàn đồ thị hoàn tất. Tổng số nút được thăm: ${visited.size}`,
    visitedNodes: Array.from(visited),
    path: [...edges]
  });
  
  animationState.algorithmSteps = steps;
}
function generateKruskalSteps() {
  if (graph.directed) {
    animationState.algorithmSteps = [{
      description: "Kruskal chỉ áp dụng cho đồ thị vô hướng!",
    }];
    return;
  }
  
  const steps = [];
  const parent = {};
  const rank = {};
  const edges = [];
  let totalWeight = 0;
  
  function find(node) {
    if (!parent[node]) parent[node] = node;
    if (parent[node] !== node) parent[node] = find(parent[node]);
    return parent[node];
  }
  
  function union(node1, node2) {
    const root1 = find(node1);
    const root2 = find(node2);
    if (root1 !== root2) {
      if (!rank[root1]) rank[root1] = 0;
      if (!rank[root2]) rank[root2] = 0;
      if (rank[root1] < rank[root2]) parent[root1] = root2;
      else if (rank[root1] > rank[root2]) parent[root2] = root1;
      else {
        parent[root2] = root1;
        rank[root1]++;
      }
    }
  }
  
  const sortedEdges = [...graph.edges].sort((a, b) => a.weight - b.weight);
  
  steps.push({
    description: "Bắt đầu thuật toán Kruskal. Sắp xếp các cạnh theo trọng số.",
    path: []
  });
  
  sortedEdges.forEach(edge => {
    steps.push({
      description: `Kiểm tra cạnh ${edge.from} -> ${edge.to} với trọng số ${edge.weight}`,
      currentEdge: { from: edge.from, to: edge.to },
      path: [...edges]
    });
    
    if (find(edge.from) !== find(edge.to)) {
      union(edge.from, edge.to);
      edges.push({ from: edge.from, to: edge.to });
      totalWeight += edge.weight;
      
      steps.push({
        description: `Thêm cạnh ${edge.from} -> ${edge.to} vào MST. Tổng trọng số hiện tại: ${totalWeight}`,
        currentEdge: { from: edge.from, to: edge.to },
        path: [...edges]
      });
    } else {
      steps.push({
        description: `Bỏ qua cạnh ${edge.from} -> ${edge.to} vì tạo chu trình`,
        currentEdge: { from: edge.from, to: edge.to },
        path: [...edges]
      });
    }
  });
  
  steps.push({
    description: `Kruskal hoàn tất. MST có tổng trọng số: ${totalWeight}`,
    path: [...edges]
  });
  
  animationState.algorithmSteps = steps;
}

function generatePrimSteps() {
  if (graph.directed) {
    animationState.algorithmSteps = [{
      description: "Prim chỉ áp dụng cho đồ thị vô hướng!",
    }];
    return;
  }
  
  if (graph.nodes.length === 0) {
    animationState.algorithmSteps = [{
      description: "Đồ thị không có nút nào!",
    }];
    return;
  }
  
  const steps = [];
  const visited = new Set();
  const edges = [];
  let totalWeight = 0;
  
  const startNode = graph.nodes[0].id;
  visited.add(startNode);
  
  const availableEdges = graph.multigraph
    ? [...graph.edges]
    : graph.edges.reduce((acc, edge) => {
        const key = [edge.from, edge.to].sort().join('-');
        if (!acc[key] || acc[key].weight > edge.weight) {
          acc[key] = edge;
        }
        return acc;
      }, {});
  
  const edgesList = graph.multigraph ? availableEdges : Object.values(availableEdges);
  
  steps.push({
    description: `Bắt đầu thuật toán Prim từ nút ${startNode}`,
    currentNode: startNode,
    visitedNodes: Array.from(visited),
    path: []
  });
  
  while (visited.size < graph.nodes.length) {
    let minEdge = null;
    let minWeight = Infinity;
    
    edgesList.forEach(edge => {
      const fromIn = visited.has(edge.from);
      const toIn = visited.has(edge.to);
      if (fromIn !== toIn && edge.weight < minWeight) {
        minEdge = edge;
        minWeight = edge.weight;
      }
    });
    
    if (!minEdge) {
      const unvisited = graph.nodes.filter(node => !visited.has(node.id)).map(n => n.id);
      steps.push({
        description: `Prim hoàn tất. Đồ thị không liên thông, các nút chưa được thêm: ${unvisited.join(', ')}`,
        visitedNodes: Array.from(visited),
        path: [...edges]
      });
      break;
    }
    
    edges.push({ from: minEdge.from, to: minEdge.to });
    totalWeight += minEdge.weight;
    
    const newNode = visited.has(minEdge.from) ? minEdge.to : minEdge.from;
    visited.add(newNode);
    
    steps.push({
      description: `Thêm cạnh ${minEdge.from} -> ${minEdge.to} (trọng số: ${minEdge.weight}) vào MST. Tổng trọng số: ${totalWeight}`,
      currentEdge: { from: minEdge.from, to: minEdge.to },
      currentNode: newNode,
      visitedNodes: Array.from(visited),
      path: [...edges]
    });
  }
  
  if (visited.size === graph.nodes.length) {
    steps.push({
      description: `Prim hoàn tất. MST có tổng trọng số: ${totalWeight}`,
      visitedNodes: Array.from(visited),
      path: [...edges]
    });
  }
  
  animationState.algorithmSteps = steps;
}

function generateBellmanFordSteps(startNode) {
  const steps = [];
  const distances = {};
  const prev = {};
  const edges = [];
  
  graph.nodes.forEach(node => {
    distances[node.id] = Infinity;
    prev[node.id] = null;
  });
  distances[startNode] = 0;
  
  steps.push({
    description: `Khởi tạo Bellman-Ford từ nút ${startNode}. Khoảng cách đến ${startNode} = 0, các nút khác = ∞`,
    currentNode: startNode,
    customState: { distances: { ...distances }, prev: { ...prev } }
  });
  
  for (let i = 0; i < graph.nodes.length - 1; i++) {
    steps.push({
      description: `Vòng lặp thứ ${i + 1}: Kiểm tra tất cả các cạnh`,
      customState: { distances: { ...distances }, prev: { ...prev } }
    });
    
    let updated = false;
    
    graph.edges.forEach(edge => {
      const u = edge.from;
      const v = edge.to;
      const w = edge.weight;
      
      steps.push({
        description: `Kiểm tra cạnh ${u} -> ${v} (trọng số: ${w})`,
        currentEdge: { from: u, to: v },
        customState: { distances: { ...distances }, prev: { ...prev } }
      });
      
      if (distances[u] !== Infinity && distances[u] + w < distances[v]) {
        distances[v] = distances[u] + w;
        prev[v] = u;
        updated = true;
        
        // Update edges for visualization
        const existingEdgeIndex = edges.findIndex(e => e.to === v);
        if (existingEdgeIndex !== -1) {
          edges.splice(existingEdgeIndex, 1);
        }
        edges.push({ from: u, to: v });
        
        steps.push({
          description: `Cập nhật khoảng cách đến ${v} = ${distances[v]} và đặt prev[${v}] = ${u}`,
          currentEdge: { from: u, to: v },
          currentNode: v,
          customState: { distances: { ...distances }, prev: { ...prev } },
          path: [...edges]
        });
      } else {
        steps.push({
          description: `Không cập nhật khoảng cách đến ${v} vì ${distances[u] === Infinity ? '∞' : distances[u] + w} ≥ ${distances[v] === Infinity ? '∞' : distances[v]}`,
          currentEdge: { from: u, to: v },
          customState: { distances: { ...distances }, prev: { ...prev } }
        });
      }
      
      if (!graph.directed) {
        steps.push({
          description: `Kiểm tra cạnh ngược ${v} -> ${u} (trọng số: ${w})`,
          currentEdge: { from: v, to: u },
          customState: { distances: { ...distances }, prev: { ...prev } }
        });
        
        if (distances[v] !== Infinity && distances[v] + w < distances[u]) {
          distances[u] = distances[v] + w;
          prev[u] = v;
          updated = true;
          
          const existingEdgeIndex = edges.findIndex(e => e.to === u);
          if (existingEdgeIndex !== -1) {
            edges.splice(existingEdgeIndex, 1);
          }
          edges.push({ from: v, to: u });
          
          steps.push({
            description: `Cập nhật khoảng cách đến ${u} = ${distances[u]} và đặt prev[${u}] = ${v}`,
            currentEdge: { from: v, to: u },
            currentNode: u,
            customState: { distances: { ...distances }, prev: { ...prev } },
            path: [...edges]
          });
        } else {
          steps.push({
            description: `Không cập nhật khoảng cách đến ${u} vì ${distances[v] === Infinity ? '∞' : distances[v] + w} ≥ ${distances[u] === Infinity ? '∞' : distances[u]}`,
            currentEdge: { from: v, to: u },
            customState: { distances: { ...distances }, prev: { ...prev } }
          });
        }
      }
    });
    
    if (!updated) {
      steps.push({
        description: `Không có cập nhật nào trong vòng lặp ${i + 1}. Kết thúc sớm.`,
        customState: { distances: { ...distances }, prev: { ...prev } },
        path: [...edges]
      });
      break;
    }
  }
  
  // Kiểm tra chu trình âm
  let hasNegativeCycle = false;
  graph.edges.forEach(edge => {
    const u = edge.from;
    const v = edge.to;
    const w = edge.weight;
    
    if (distances[u] !== Infinity && distances[u] + w < distances[v]) {
      hasNegativeCycle = true;
    }
    if (!graph.directed && distances[v] !== Infinity && distances[v] + w < distances[u]) {
      hasNegativeCycle = true;
    }
  });
  
  if (hasNegativeCycle) {
    steps.push({
      description: "Phát hiện chu trình âm! Thuật toán kết thúc.",
      customState: { distances: { ...distances }, prev: { ...prev } }
    });
  } else {
    let result = `Bellman-Ford hoàn tất. Khoảng cách từ ${startNode}:\n`;
    graph.nodes.forEach(node => {
      result += `${startNode} -> ${node.id}: ${distances[node.id] === Infinity ? '∞' : distances[node.id]}\n`;
    });
    
    steps.push({
      description: result,
      customState: { distances: { ...distances }, prev: { ...prev } },
      path: [...edges]
    });
  }
  
  animationState.algorithmSteps = steps;
}

function generateFloydSteps(startNode, endNode) {
  const steps = [];
  const dist = {};
  const next = {};

  // Initialize distance and next matrices
  steps.push({
    description: `Khởi tạo Floyd-Warshall để tìm đường đi từ ${startNode} đến ${endNode}`,
  });

  // Initialize distance and next matrices
  graph.nodes.forEach(u => {
    dist[u.id] = {};
    next[u.id] = {};
    graph.nodes.forEach(v => {
      dist[u.id][v.id] = u.id === v.id ? 0 : Infinity;
      next[u.id][v.id] = null;
    });
  });

  // Set direct edge distances
  graph.edges.forEach(edge => {
    // For directed graphs, only set in one direction
    dist[edge.from][edge.to] = edge.weight;
    next[edge.from][edge.to] = edge.to;
    
    // For undirected graphs, set in both directions
    if (!graph.directed) {
      dist[edge.to][edge.from] = edge.weight;
      next[edge.to][edge.from] = edge.from;
    }
  });

  steps.push({
    description: "Distances initialized with direct edge weights",
    customState: { distances: { ...dist } }
  });

  // Main Floyd-Warshall algorithm
  graph.nodes.forEach(k => {
    steps.push({
      description: `Considering intermediate node ${k.id}`,
      currentNode: k.id
    });

    graph.nodes.forEach(i => {
      graph.nodes.forEach(j => {
        if (dist[i.id][k.id] + dist[k.id][j.id] < dist[i.id][j.id]) {
          const oldDist = dist[i.id][j.id] === Infinity ? "∞" : dist[i.id][j.id];
          const newDist = dist[i.id][k.id] + dist[k.id][j.id];
          
          dist[i.id][j.id] = newDist;
          next[i.id][j.id] = next[i.id][k.id];
          
          steps.push({
            description: `Improving path from ${i.id} to ${j.id} via ${k.id}: ${oldDist} → ${newDist}`,
            currentNode: k.id,
            customState: { distances: { ...dist } }
          });
        }
      });
    });
  });

  // Check if a path exists from start to end
  if (dist[startNode][endNode] === Infinity) {
    steps.push({
      description: `Không tìm thấy đường đi từ ${startNode} đến ${endNode}`,
      customState: { distances: { ...dist } }
    });
  } else {
    // Reconstruct path
    let path = [startNode];
    const edges = [];
    let current = startNode;
    
    while (current !== endNode) {
      const nextNode = next[current][endNode];
      if (!nextNode) break;
      
      path.push(nextNode);
      edges.push({ from: current, to: nextNode });
      current = nextNode;
    }

    steps.push({
      description: `Tìm thấy đường đi ngắn nhất: ${path.join(' -> ')} với tổng trọng số = ${dist[startNode][endNode]}`,
      customState: { distances: { ...dist } },
      path: edges
    });
  }

  animationState.algorithmSteps = steps;
}

// TODO: Add implementations for other algorithms

function runAlgorithm(algorithm) {
  if (!graph.nodes.length || !graph.edges.length) {
    displayResult('Vui lòng nhập dữ liệu đồ thị trước!');
    return;
  }

  const startNode = document.getElementById('startNode').value.trim();
  const endNode = document.getElementById('endNode').value.trim();

  if (!['dfsGeneral', 'bfsGeneral', 'prim', 'kruskal'].includes(algorithm)) {
    if (!startNode) {
      displayResult('Vui lòng nhập điểm đầu!');
      return;
    }
    const startNodeExists = graph.nodes.some(node => node.id === startNode);
    if (!startNodeExists) {
      displayResult('Điểm đầu không tồn tại trong đồ thị!');
      return;
    }
  }

  const endNodeExists = graph.nodes.some(node => node.id === endNode);
  if (['dijkstra', 'floyd'].includes(algorithm)) {
    if (!endNode) {
      displayResult('Vui lòng nhập điểm cuối!');
      return;
    }
    if (!endNodeExists) {
      displayResult('Điểm cuối không tồn tại trong đồ thị!');
      return;
    }
  }

  const hasNegativeWeight = graph.edges.some(edge => edge.weight < 0);
  if (hasNegativeWeight) {
    if (algorithm === 'dijkstra') {
      displayResult('Dijkstra không hỗ trợ trọng số âm! Vui lòng dùng Bellman-Ford hoặc Floyd-Warshall.');
      return;
    } else if (algorithm === 'kruskal' || algorithm === 'prim') {
      displayResult(`${algorithm.charAt(0).toUpperCase() + algorithm.slice(1)} không đảm bảo kết quả đúng với trọng số âm!`);
    }
  }

  // Initialize animation for the selected algorithm
  initializeAnimation(algorithm, { startNode, endNode });
  
  // Display initial state
  if (animationState.algorithmSteps.length > 0) {
    displayResult('Mô phỏng sẵn sàng. Nhấn Play hoặc Step để bắt đầu.');
  } else {
    displayResult('Không thể tạo các bước mô phỏng cho thuật toán này.');
  }
}

document.getElementById('run').addEventListener('click', () => {
  const algorithm = document.getElementById('algorithm').value;
  runAlgorithm(algorithm);
});

document.getElementById('drawGraphButton').addEventListener('click', () => {
  if (manualInputRadio.checked) {
    const isValidInput = parseManualInput();
    if (isValidInput) drawGraph();
  } else if (fileInputRadio.checked) {
    if (graph.nodes.length > 0 || graph.edges.length > 0) {
      // Dữ liệu đã được tải từ file, chỉ cần vẽ lại với cấu hình mới
      graph.directed = document.getElementById('isDirected').checked;
      graph.multigraph = document.getElementById('isMultigraph').checked;
      displayGraphType();
      drawGraph();
    } else {
      displayResult('Vui lòng tải file trước khi vẽ đồ thị!');
    }
  }
});

document.getElementById('clearGraphButton').addEventListener('click', () => {
  clearGraph();
  resetAnimation();
});

// Animation control event listeners
playBtn.addEventListener('click', playAnimation);
pauseBtn.addEventListener('click', pauseAnimation);
stepBtn.addEventListener('click', stepAnimation);
resetBtn.addEventListener('click', resetAnimation);

speedSlider.addEventListener('input', () => {
  animationState.speed = parseInt(speedSlider.value);
  if (animationState.isRunning) {
    // Restart the animation with the new speed
    pauseAnimation();
    playAnimation();
  }
});

function resizeCanvas() {
  const outputSection = document.getElementById('output-section');
  canvas.width = outputSection.clientWidth - 20;
  canvas.height = outputSection.clientHeight - 40;
  drawGraph();
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

toggleInputMethod();
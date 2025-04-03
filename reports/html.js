import * as Formatting from '../utils/formatting.js'; 
import * as OpenApiSuggestion from '../openapi/suggestion.js';

export function generateHtmlReportContent(analysisResult) {
    const { suggestions, summary, legend } = analysisResult;

    let htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Analysis Report</title>
    <style>
        body { font-family: sans-serif; line-height: 1.6; padding: 20px; }
        h1, h2, h3 { color: #333; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 30px;}
        table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .summary-table td:first-child { font-weight: bold; width: 200px; }
        .legend-table td:first-child { font-weight: bold; width: 250px; }
        .suggestions-table th:last-child, .suggestions-table td:last-child { text-align: right; } /* Align hours right */
        .container { max-width: 1200px; margin: auto; }
        code { background-color: #eee; padding: 2px 4px; border-radius: 3px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Test Analysis Report</h1>
        <p>Generated: ${new Date().toISOString()}</p>

        <h2>Summary</h2>
        <table class="summary-table">
            <tr><td>Total Paths Analyzed:</td><td>${summary.totalPaths}</td></tr>
            <tr><td>Total Operations Found:</td><td>${summary.totalOperations}</td></tr>
            <tr><td>Total Test Suggestions:</td><td>${summary.totalSuggestions}</td></tr>
            <tr><td>Total Estimated Hours:</td><td>${Formatting.formatNumberCommaDecimal(summary.totalEstimatedHours)}</td></tr>
            <tr><td colspan="2"><strong>Operations by Verb:</strong></td></tr>
            ${Object.entries(summary.verbCounts).filter(([, count]) => count > 0).map(([verb, count]) => `<tr><td>${verb.toUpperCase()}</td><td>${count}</td></tr>`).join('')}
        </table>

        <h2>Test Type Legend</h2>
        <table class="legend-table">
            <thead><tr><th>Type</th><th>Description</th></tr></thead>
            <tbody>
                ${Array.from(legend.entries()).map(([type, desc]) => `<tr><td>${type}</td><td>${desc}</td></tr>`).join('')}
            </tbody>
        </table>

        <h2>Test Suggestions</h2>
        <table class="suggestions-table">
            <thead>
                <tr>
                    <th>Operation ID / Summary</th>
                    <th>Verb</th>
                    <th>Path</th>
                    <th>Test Type</th>
                    <th>Test Description</th>
                    <th>Est. Hours</th>
                </tr>
            </thead>
            <tbody>
                ${suggestions.map(s => `
                <tr>
                    <td>${s.operationId}</td>
                    <td>${s.verb}</td>
                    <td><code>${s.path}</code></td>
                    <td>${OpenApiSuggestion.getTestTypeDescription(s.type)}</td>
                    <td><div>${s.description} </br> ${OpenApiSuggestion.getSuggestionDescription(s.type,s.verb)}</div></td>
                    <td>${Formatting.formatNumberCommaDecimal(s.estimatedHours)}</td>
                </tr>`).join('')}
            </tbody>
        </table>
    </div>
</body>
</html>`;
    return htmlContent;
}
import * as Formatting from '../utils/formatting.js'; 
import * as OpenApiSuggestion from '../openapi/suggestion.js';


export function generateCsvReportContent(analysisResult) {
    const { suggestions, summary, legend } = analysisResult;
	const csvSeparator = ';'; // Para compatibilidad Excel con formato español/europeo
	console.log(`csvSeparator: ${csvSeparator}`); // Adiciona esta línea para verificar el valor
    //Con let csvContent = "\ufeff", de esta forma, el archivo CSV incluirá el BOM y muchos visores (como Excel) reconocerán correctamente los caracteres acentuados.
    let csvContent = "\ufeff"; 

    // Header
    csvContent += `Test Analysis Report\n`;
    csvContent += `Generated: ${new Date().toISOString()}\n\n`;

    // Summary Section
    csvContent += `Summary\n`;
    csvContent += `Total Paths Analyzed${csvSeparator}${summary.totalPaths}\n`;
    csvContent += `Total Operations Found${csvSeparator}${summary.totalOperations}\n`;
    csvContent += `Total Test Suggestions${csvSeparator}${summary.totalSuggestions}\n`;
    csvContent += `Total Estimated Hours${csvSeparator}${Formatting.formatNumberCommaDecimal(summary.totalEstimatedHours)}\n`;
    csvContent += `Operations by Verb:\n`;
    for (const verb in summary.verbCounts) {
        if (summary.verbCounts[verb] > 0) { // Only show verbs that were found
            csvContent += `${verb.toUpperCase()}${csvSeparator}${summary.verbCounts[verb]}\n`;
        }
    }
    csvContent += `\n`; // Separator line

    // Legend Section
    csvContent += `Test Type Legend\n`;
    csvContent += `Type${csvSeparator}Description\n`;
    legend.forEach((desc, type) => {
        csvContent += `${Formatting.escapeCsvValue(type)}${csvSeparator}${Formatting.escapeCsvValue(desc)}\n`;
    });
    csvContent += `\n`; // Separator line

    // Suggestions Table Header
    // Note: CSV alignment is determined by the viewing application (Excel, Sheets, etc.)
    // We ensure clean data without extra spaces.
    const headers = ["Operation ID", "Verb", "Path", "Test Type", "Test Description", "Est. Hours"];
    csvContent += headers.map(h => Formatting.escapeCsvValue(h)).join(csvSeparator) + '\n';

    // Suggestions Table Rows
    suggestions.forEach(s => {
        const row = [
            s.operationId,
            s.verb,
            s.path,
            OpenApiSuggestion.getTestTypeDescription(s.type),
			OpenApiSuggestion.getSuggestionDescription(s.type,s.verb),
            Formatting.formatNumberCommaDecimal(s.estimatedHours) // Format hours with comma decimal
        ];
        csvContent += row.map(cell => Formatting.escapeCsvValue(cell)).join(csvSeparator) + '\n';
    });

    return csvContent;
}
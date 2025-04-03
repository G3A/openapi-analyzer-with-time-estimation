import fs from 'fs';
import { exec } from 'child_process';

import * as OpenApiAnalyzer from './openapi/analyzer.js';
import * as OpenApiSuggestion from './openapi/suggestion.js';
import * as CsvReport from './reports/csv.js';
import * as HtmlReport from './reports/html.js'

// --- Configuración ---
const openapiFilePath=''; // <-- ¡IMPORTANTE! Pon la ruta correcta a tu archivo OpenAPI

const outputJsonFile = 'postman_collection.json';
const outputCsvFile = 'test_analysis_report.csv';
const outputHtmlFile = 'test_analysis_report.html'; // Nombre para el reporte HTML

const defaultTokenVar = '{{token}}'; // Variable Postman para el token (si se necesita)
const defaultApiKeyHeader = 'X-API-Key'; // Header común para API Key
const defaultApiKeyVar = '{{apiKey}}'; // Variable Postman para API Key (si se necesita)

const nonExistentIdVar = '{{nonExistentId}}'; // Placeholder para IDs que no existen

const generateCsvReport = true; // Generar el reporte CSV?
const generateHtmlReport = true; // Generar el reporte HTML (recomendado para mejor formato)?
const generatePostmanCollection = true; // Generar la colección Postman?
const openReportAfterGeneration = true; // Abrir el reporte (HTML si existe, si no CSV) automáticamente?
const openPostmanAfterGeneration = false; // Intentar abrir Postman (puede no funcionar) - Requiere Newman o similar instalado y configurado


// --- Fin Configuración ---


// --- Main Execution ---

(async () => {
	const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error("Uso: node analyze_openapi.js <ruta_al_archivo_openapi.yaml_o_json>");
        process.exit(1);
    }
    const openapiFilePath = args[0];
    if (!fs.existsSync(openapiFilePath)) {
        console.error(`Error: OpenAPI file not found at '${openapiFilePath}'. Please update the 'openapiFilePath' variable in the script.`);
        process.exit(1);
    }

    const analysisResult = OpenApiAnalyzer.analyzeOpenApi(openapiFilePath);

    if (!analysisResult) {
        console.error("Analysis failed. Exiting.");
        process.exit(1);
    }

    // Generate Postman Collection
    if (generatePostmanCollection) {
        try {
            fs.writeFileSync(outputJsonFile, JSON.stringify(analysisResult.collection, null, 2), 'utf8');
            console.log(`Postman collection saved to: ${outputJsonFile}`);
            if (openPostmanAfterGeneration) {
                console.log("Attempting to open Postman (requires Postman installed and accessible)...");
                try {
                    // This is platform-dependent and might not work reliably
                    const command = process.platform === 'win32' ? `start "" "${outputJsonFile}"` :
                                    process.platform === 'darwin' ? `open "${outputJsonFile}"` :
                                    `xdg-open "${outputJsonFile}"`; // Linux
                    exec(command, (err) => {
                        if (err) console.warn("Could not automatically open Postman:", err.message);
                    });
                } catch (e) {
                     console.warn("Failed to execute command to open Postman:", e.message);
                }
            }
        } catch (e) {
            console.error(`Error writing Postman collection file: ${e.message}`);
        }
    }

    // Generate CSV Report
     let reportToOpen = null;
    if (generateCsvReport) {
        try {
            const csvData = CsvReport.generateCsvReportContent(analysisResult);
            fs.writeFileSync(outputCsvFile, csvData, 'utf8');
            console.log(`CSV analysis report saved to: ${outputCsvFile}`);
            reportToOpen = outputCsvFile; // Set CSV as the file to open by default
        } catch (e) {
            console.error(`Error writing CSV report file: ${e.message}`);
        }
    }

    // Generate HTML Report
    if (generateHtmlReport) {
        try {
            const htmlData = HtmlReport.generateHtmlReportContent(analysisResult);
            fs.writeFileSync(outputHtmlFile, htmlData, 'utf8');
            console.log(`HTML analysis report saved to: ${outputHtmlFile}`);
            reportToOpen = outputHtmlFile; // Prefer opening HTML if generated
        } catch (e) {
            console.error(`Error writing HTML report file: ${e.message}`);
        }
    }

    // Open the generated report (HTML preferred)
    if (openReportAfterGeneration && reportToOpen) {
        console.log(`Attempting to open report: ${reportToOpen}`);
        try {
            const command = process.platform === 'win32' ? `start "" "${reportToOpen}"` :
                            process.platform === 'darwin' ? `open "${reportToOpen}"` :
                            `xdg-open "${reportToOpen}"`; // Linux
             exec(command, (err) => {
                 if (err) console.warn(`Could not automatically open report file '${reportToOpen}': ${err.message}`);
             });
        } catch (e) {
            console.warn(`Failed to execute command to open report file '${reportToOpen}': ${e.message}`);
        }
    }

})(); // Immediately invoke the async function
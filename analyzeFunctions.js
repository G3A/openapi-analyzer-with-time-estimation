#!/usr/bin/env node
import fs from 'fs';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

// Verificamos que se pase el nombre del archivo a analizar
if (process.argv.length < 3) {
  console.error('Uso: node analyzeFunctions.mjs <archivo.js>');
  process.exit(1);
}

const fileToAnalyze = process.argv[2];

// Leemos el contenido del archivo fuente
fs.readFile(fileToAnalyze, 'utf8', (err, code) => {
  if (err) {
    console.error(`Error al leer el archivo ${fileToAnalyze}:`, err.message);
    process.exit(1);
  }

  try {
    // Parseamos el código para obtener el AST (permitiendo ECMAScript moderno)
    const ast = acorn.parse(code, {
      ecmaVersion: 2020,
      sourceType: 'module',
      locations: true // Opcional: para imprimir la línea en la que se encuentra la función
    });

    console.log(`Firmas de función encontradas en ${fileToAnalyze}:\n`);

    // Función auxiliar que formatea los parámetros como cadena
    function formatParams(params) {
      return params.map(param => {
        // Convirtiendo el nodo parámetro a una porción del código original
        return code.slice(param.start, param.end);
      }).join(', ');
    }

    // Recorrida del AST para encontrar declaraciones de función o asignaciones a variables
    walk.simple(ast, {
      // Funcion declarada: function nombre(...) { ... }
      FunctionDeclaration(node) {
        const params = formatParams(node.params);
        const funcName = node.id ? node.id.name : '<anónimo>';
        //console.log(`function ${funcName}(${params})  [Línea ${node.loc.start.line}]`);
		console.log(`function ${funcName}(${params})`);
      },
      
      // Asignación de función a variable: const nombre = function(...) { ... } o arrow function: const nombre = (...) => { ... }
      VariableDeclaration(node) {
        node.declarations.forEach(decl => {
          if (decl.init && (decl.init.type === 'FunctionExpression' || decl.init.type === 'ArrowFunctionExpression')) {
            const params = formatParams(decl.init.params);
            // El nombre se obtiene de la parte izquierda de la asignación
            const varName = decl.id.name || '<anónimo>';
            //console.log(`function ${varName}(${params})  [Línea ${decl.loc.start.line}]`);
			console.log(`function ${varName}(${params})`);
          }
        });
      }
    });
  } catch (parseError) {
    console.error(`Error al parsear el archivo ${fileToAnalyze}:`, parseError.message);
    process.exit(1);
  }
});
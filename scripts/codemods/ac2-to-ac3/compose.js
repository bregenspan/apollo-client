/**
 * This jscodeshift transform takes care of some of the rote things you'll
 * need to do while migrating from v2 to v3. See README.md for usage
 * instructions and further explanation.
 *
 * Original author: @dminkovsky (PR #6486)
 * Contributors: @jcreighton @benjamn
 * Reviewers: @hwillson @bnjmnt4n
 */
export default function transformer(file, api) {
  const j = api.jscodeshift;

  const source = j(file.source);

  // Add recompose import
  const recomposeImport = getImport("recompose");
  if (!recomposeImport.size()) {
    source
      .find(j.ImportDeclaration)
      .at(0)
      .insertBefore(() => j.importDeclaration([], j.literal("recompose")));
  }

  const moduleImport = getImport("react-apollo");
  if (moduleImport.size()) {
    const recomposeImports = getImport("recompose");

    const specifiersToMove = moduleImport.get("specifiers").value;

    function shouldMoveToRecompose(node) {
      return node.imported.name === "compose";
    }

    const recomposeSpecifiers = specifiersToMove.filter(
      (node) => node.imported.name === "compose"
    );
    recomposeImports.get("specifiers").push(...recomposeSpecifiers);
  }

  // Cleanup
  const reactApolloImport = getImport("react-apollo");
  if (
    reactApolloImport.size() &&
    !reactApolloImport.get("specifiers", "length").value
  ) {
    reactApolloImport.remove();
  }
  const recomposeImport = getImport("recompose");
  if (
    recomposeImport.size() &&
    !recomposeImport.get("specifiers", "length").value
  ) {
    recomposeImport.remove();
  }

  return source.toSource();

  function renameImport(oldModuleName, newModuleName) {
    getImport(oldModuleName)
      .find(j.Literal)
      .replaceWith((path) => ({
        ...path.value,
        value: newModuleName,
      }));
  }

  function getImport(moduleName) {
    return source.find(j.ImportDeclaration, {
      source: { value: moduleName },
    });
  }

  function renameDefaultSpecifier(moduleImport, name) {
    function replacer(path) {
      return path.value.local.name === name
        ? j.importSpecifier(j.identifier(name))
        : j.importSpecifier(j.identifier(name), path.value.local);
    }

    // Handle ordinary (no-{}s) default imports.
    moduleImport.find(j.ImportDefaultSpecifier).replaceWith(replacer);

    // Handle { default as Foo } default imports.
    moduleImport
      .find(j.ImportSpecifier, {
        imported: {
          name: "default",
        },
      })
      .replaceWith(replacer);
  }
}

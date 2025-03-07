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

  renameOrCreateApolloClientImport();

  moveSpecifiersToApolloClient('react-apollo');
  moveSpecifiersToApolloClient('@apollo/react-hooks');
  moveSpecifiersToApolloClient('apollo-cache-inmemory');
  moveSpecifiersToApolloClient('apollo-link');
  moveSpecifiersToApolloClient('apollo-link-http');
  moveSpecifiersToApolloClient('apollo-link-http-common');

  renameDefaultSpecifier(getImport('graphql-tag'), 'gql');
  moveSpecifiersToApolloClient('graphql-tag');

  renameImport('@apollo/react-components', '@apollo/client/react/components');
  renameImport('@apollo/react-hoc', '@apollo/client/react/hoc');
  renameImport('@apollo/react-ssr', '@apollo/client/react/ssr');
  renameImport('@apollo/react-testing', '@apollo/client/testing');

  renameDefaultSpecifier(getImport('apollo-link-schema'), 'SchemaLink');
  [
    'batch',
    'batch-http',
    'context',
    'error',
    'persisted-queries',
    'retry',
    'schema',
    'ws',
  ].forEach(link => renameImport(`apollo-link-${link}`, `@apollo/client/link/${link}`));

  removeApolloClientImportIfEmpty();

  return source.toSource();

  function renameOrCreateApolloClientImport() {
    const ac3Import = getImport("@apollo/client");
    if (!ac3Import.size()) {
      const ac2Import = getImport("apollo-client");
      if (ac2Import.size()) {
        renameDefaultSpecifier(ac2Import, "ApolloClient");
        renameImport("apollo-client", "@apollo/client");
      } else {
        source
          .find(j.ImportDeclaration)
          .at(0)
          .insertBefore(() =>
            j.importDeclaration([], j.literal("@apollo/client"))
          );
      }
    }

    const hocImport = getImport("@apollo/client/react/hoc");
    if (!hocImport.size()) {
      source
        .find(j.ImportDeclaration)
        .at(0)
        .insertBefore(() =>
          j.importDeclaration([], j.literal("@apollo/client/react/hoc"))
        );
    }

    const recomposeImport = getImport("recompose");
    if (!recomposeImport.size()) {
      source
        .find(j.ImportDeclaration)
        .at(0)
        .insertBefore(() => j.importDeclaration([], j.literal("recompose")));
    }
  }

  function removeApolloClientImportIfEmpty() {
    const ac3Import = getImport("@apollo/client");
    if (ac3Import.size() && !ac3Import.get("specifiers", "length").value) {
      ac3Import.remove();
    }
    const hocImport = getImport("@apollo/client/react/hoc");
    if (hocImport.size() && !hocImport.get("specifiers", "length").value) {
      hocImport.remove();
    }

    const recomposeImport = getImport("recompose");
    if (
      recomposeImport.size() &&
      !recomposeImport.get("specifiers", "length").value
    ) {
      recomposeImport.remove();
    }
  }

  function moveSpecifiersToApolloClient(moduleName) {
    const moduleImport = getImport(moduleName);

    if (moduleImport.size()) {
      const clientImports = getImport("@apollo/client");
      const hocImports = getImport("@apollo/client/react/hoc");
      const recomposeImports = getImport("recompose");

      const specifiersToAdd = moduleImport.get("specifiers").value;

      function shouldMoveToRecompose(node) {
        return node.imported.name === "compose";
      }
      function shouldMoveToHoc(node) {
        return (
          node.imported.name === "graphql" ||
          node.imported.name === "withApollo"
        );
      }
      const hocSpecifiers = specifiersToAdd.filter(shouldMoveToHoc);
      const recomposeSpecifiers = specifiersToAdd.filter(shouldMoveToRecompose);
      const clientSpecifiers = specifiersToAdd.filter(s => {
        return !(shouldMoveToRecompose(s) || shouldMoveToHoc(s));
      });

      hocImports.get("specifiers").push(...hocSpecifiers);
      recomposeImports.get("specifiers").push(...recomposeSpecifiers);
      clientImports.get("specifiers").push(...clientSpecifiers);
    }

    moduleImport.remove();
  }

  function renameImport(oldModuleName, newModuleName) {
    getImport(oldModuleName)
      .find(j.Literal)
      .replaceWith(path => ({
        ...path.value,
        value: newModuleName
      }));
  }

  function getImport(moduleName) {
    return source.find(j.ImportDeclaration, {
      source: { value: moduleName }
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
          name: "default"
        }
      })
      .replaceWith(replacer);
  }
}

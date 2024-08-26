import { Endpoints } from '@octokit/types';
import 'isomorphic-fetch';

export const getReadme = (repo = 'styled-components'): Promise<string> =>
  fetch(`https://cdn.rawgit.com/styled-components/${repo}/master/README.md`).then(resp => resp.text());

export const getReleases = (
  repo = 'MarkFlowy'
): Promise<Endpoints['GET /repos/{owner}/{repo}/releases']['response']['data']> =>
  fetch(`https://api.github.com/repos/drl990114/${repo}/releases?per_page=999`).then(resp => resp.json());

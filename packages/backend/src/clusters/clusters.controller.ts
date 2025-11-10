import { UUID } from 'node:crypto';
import {
  Controller,
  Get,
  Param,
  Delete,
  HttpStatus,
  HttpCode,
  Post,
} from '@nestjs/common';
import { ClustersService } from './clusters.service.js';
import {
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Cluster } from './entities/cluster.entity.js';

@ApiTags('Clusters')
@Controller('clusters')
export class ClustersController {
  constructor(private readonly clustersService: ClustersService) {}

  @Get()
  @ApiOkResponse({
    description: 'The list of clusters.',
    type: Cluster,
    isArray: true,
  })
  findAll() {
    return this.clustersService.findAll();
  }

  @Get(':id')
  @ApiOkResponse({
    description: 'The cluster based on the given ID.',
    type: Cluster,
  })
  @ApiNotFoundResponse({
    description: 'The ID points to an unresolved cluster.',
  })
  findOne(@Param('id') id: UUID) {
    return this.clustersService.findOne(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'The cluster with the given ID has been deleted.',
  })
  @ApiNotFoundResponse({
    description: 'The ID points to an unresolved cluster.',
  })
  async remove(@Param('id') id: UUID) {
    await this.clustersService.remove(id);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'The cluster with the given ID is starting.',
  })
  @ApiNotFoundResponse({
    description: 'The ID points to an unresolved cluster.',
  })
  async start(@Param('id') id: UUID) {
    await this.clustersService.startById(id);
  }

  @Post(':id/stop')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'The cluster with the given ID has been stopped.',
  })
  @ApiNotFoundResponse({
    description: 'The ID points to an unresolved cluster.',
  })
  async stop(@Param('id') id: UUID) {
    await this.clustersService.stopById(id);
  }

  @Post(':id/restart')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'The cluster with the given ID is restarting.',
  })
  @ApiNotFoundResponse({
    description: 'The ID points to an unresolved cluster.',
  })
  async restart(@Param('id') id: UUID) {
    await this.clustersService.restartById(id);
  }
}
